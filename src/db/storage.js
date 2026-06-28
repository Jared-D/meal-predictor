import localforage from 'localforage';
import { PRESET_MEALS } from '../data/presetMeals';

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
// Each day is stored under its ISO date key, e.g. '2026-06-28':
//   { date, weather, specialOccasion, meals: [mealId, ...] }

export async function getDay(date) {
  return (await historyStore.getItem(date)) || null;
}

export async function saveDay(day) {
  if (!day || !day.date) throw new Error('Day record must include a date');
  await historyStore.setItem(day.date, day);
  return day;
}

// Records (merges) the chosen meals + questionnaire answers for a date.
export async function recordDay({ date, weather, specialOccasion, meals }) {
  const existing = (await getDay(date)) || { date, meals: [] };
  const mergedMeals = Array.from(new Set([...(existing.meals || []), ...(meals || [])]));
  const day = {
    date,
    weather: weather ?? existing.weather ?? 'mild',
    specialOccasion: specialOccasion ?? existing.specialOccasion ?? false,
    meals: mergedMeals,
  };
  return saveDay(day);
}

export async function deleteDay(date) {
  await historyStore.removeItem(date);
}

// All recorded days, sorted ascending by date.
export async function getHistory() {
  const days = [];
  await historyStore.iterate((value) => {
    if (value && value.date) days.push(value);
  });
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return days;
}

/* ----------------------------- Meta ------------------------------ */

export async function getMeta(key) {
  return metaStore.getItem(key);
}

export async function setMeta(key, value) {
  return metaStore.setItem(key, value);
}
