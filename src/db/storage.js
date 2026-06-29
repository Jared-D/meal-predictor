import localforage from 'localforage';
import { PRESET_MEALS } from '../data/presetMeals';
import { compareRecords } from '../ml/encoding';

// Three IndexedDB-backed stores under one database.
const mealStore = localforage.createInstance({ name: 'meal-predictor', storeName: 'meals' });
const historyStore = localforage.createInstance({ name: 'meal-predictor', storeName: 'history' });
const metaStore = localforage.createInstance({ name: 'meal-predictor', storeName: 'meta' });

const MEALS_KEY = 'meals';

/* ----------------------------- Meals ----------------------------- */

// Returns the meal list, seeding it with the presets on first run.
export async function getMeals() {
  let meals = await mealStore.getItem(MEALS_KEY);
  if (!Array.isArray(meals)) {
    meals = PRESET_MEALS.map((m) => ({ ...m }));
    await mealStore.setItem(MEALS_KEY, meals);
  }
  return meals;
}

export async function saveMeals(meals) {
  await mealStore.setItem(MEALS_KEY, meals);
  return meals;
}

// Adds a meal (returns the new list). Reuses an existing meal if the name
// already exists (case-insensitive) so custom entries don't create duplicates.
export async function addMeal(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Meal name cannot be empty');
  const meals = await getMeals();
  const existing = meals.find((m) => m.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return { meals, meal: existing, created: false };
  const nextId = meals.reduce((max, m) => Math.max(max, m.id), 0) + 1;
  const meal = { id: nextId, name: trimmed };
  const updated = [...meals, meal];
  await saveMeals(updated);
  return { meals: updated, meal, created: true };
}

export async function removeMeal(id) {
  const meals = await getMeals();
  const updated = meals.filter((m) => m.id !== id);
  await saveMeals(updated);
  return updated;
}

/* ---------------------------- History ---------------------------- */
// History is granular per (date, mealTime). Each slot is stored under a
// composite key 'YYYY-MM-DD__mealTime', e.g. '2026-06-28__dinner':
//   { date, mealTime, weather, specialOccasion, meals: [mealId, ...] }

const slotKey = (date, mealTime) => `${date}__${mealTime}`;

export async function getSlot(date, mealTime) {
  return (await historyStore.getItem(slotKey(date, mealTime))) || null;
}

export async function saveSlot(record) {
  if (!record || !record.date || !record.mealTime) {
    throw new Error('Record must include a date and mealTime');
  }
  await historyStore.setItem(slotKey(record.date, record.mealTime), record);
  return record;
}

// Builds a merged slot record (merging meals with any existing entry).
function mergeSlot(existing, { date, mealTime, weather, specialOccasion, meals }) {
  const base = existing || { date, mealTime, meals: [] };
  const mergedMeals = Array.from(new Set([...(base.meals || []), ...(meals || [])]));
  return {
    date,
    mealTime,
    weather: weather ?? base.weather ?? 'mild',
    specialOccasion: specialOccasion ?? base.specialOccasion ?? false,
    meals: mergedMeals,
  };
}

// Records (merges) the chosen meals + questionnaire answers for one slot.
export async function recordSlot(entry) {
  const existing = await getSlot(entry.date, entry.mealTime);
  return saveSlot(mergeSlot(existing, entry));
}

// Writes many slot records at once (used for seeding demo history) and returns
// the refreshed history. Each entry is merged with any existing slot.
export async function recordManySlots(entries) {
  for (const entry of entries) {
    const existing = await getSlot(entry.date, entry.mealTime);
    await saveSlot(mergeSlot(existing, entry));
  }
  return getHistory();
}

export async function deleteSlot(date, mealTime) {
  await historyStore.removeItem(slotKey(date, mealTime));
}

// All recorded slots, sorted ascending by date then breakfast < lunch < dinner.
export async function getHistory() {
  const records = [];
  await historyStore.iterate((value) => {
    if (value && value.date && value.mealTime) records.push(value);
  });
  records.sort(compareRecords);
  return records;
}

/* --------------------------- Import/Export ------------------------- */

// Replaces all meals and history with data from an export file.
export async function importAll({ meals: importedMeals, history: importedHistory }) {
  await saveMeals(importedMeals);
  await historyStore.clear();
  for (const slot of importedHistory) {
    if (slot.date && slot.mealTime) {
      await historyStore.setItem(slotKey(slot.date, slot.mealTime), slot);
    }
  }
}

/* ----------------------------- Meta ------------------------------ */

export async function getMeta(key) {
  return metaStore.getItem(key);
}

export async function setMeta(key, value) {
  return metaStore.setItem(key, value);
}
