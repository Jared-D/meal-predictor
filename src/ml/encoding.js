// One-hot / cyclical encoding utilities that turn meal-slot records into the
// fixed-shape tensors the model consumes.
//
// History is granular per (date, mealTime) slot — breakfast, lunch and dinner
// are stored as separate records for each date. A single model handles all meal
// times; the time of day is fed in as a CYCLICAL feature (sin/cos of the hour)
// so that 7am, 12pm and 7pm are continuous and 23:00 sits next to 01:00. Picking
// a different meal time therefore yields a different prediction from the one
// model.
//
// Each record is encoded as a feature vector:
//   [ weather(3) | specialOccasion(2) | timeOfDay(2: sin,cos) | meals(M) ]
// and a model input is a sequence of SEQUENCE_LENGTH such vectors (the past 365
// days × 3 slots, including the current session slot).

export const WEATHER_OPTIONS = ['hot', 'mild', 'cold'];
export const MEAL_TIMES = ['breakfast', 'lunch', 'dinner'];

// Representative hour-of-day for each meal time, used for the cyclical encoding.
export const MEAL_TIME_HOURS = { breakfast: 7, lunch: 12, dinner: 19 };

export const DAYS_OF_HISTORY = 365;
export const SLOTS_PER_DAY = MEAL_TIMES.length;
export const SEQUENCE_LENGTH = DAYS_OF_HISTORY * SLOTS_PER_DAY;

// weather one-hot (3) + special-occasion one-hot (2) + time-of-day cyclical (2)
export const QUESTION_FEATURES = WEATHER_OPTIONS.length + 2 + 2;

export const featuresPerDay = (vocab) => QUESTION_FEATURES + vocab.size;

// Sort order so a day's slots stay in chronological order.
const TIME_ORDER = new Map(MEAL_TIMES.map((t, i) => [t, i]));

// Builds a stable id<->index mapping for the current meal list.
export function buildVocab(meals) {
  const sorted = [...meals].sort((a, b) => a.id - b.id);
  const idToIndex = new Map();
  sorted.forEach((m, i) => idToIndex.set(m.id, i));
  return { meals: sorted, idToIndex, size: sorted.length };
}

function encodeWeather(weather) {
  return WEATHER_OPTIONS.map((w) => (w === weather ? 1 : 0));
}

function encodeOccasion(special) {
  return special ? [0, 1] : [1, 0];
}

// Cyclical encoding of the meal time's hour: [sin(2πh/24), cos(2πh/24)].
// Shifted into [0,1] so a zero vector (used for padding) stays distinct from a
// real slot and is ignored by the model's Masking layer.
function encodeTimeOfDay(mealTime) {
  const hour = MEAL_TIME_HOURS[mealTime] ?? 12;
  const angle = (2 * Math.PI * hour) / 24;
  return [(Math.sin(angle) + 1) / 2, (Math.cos(angle) + 1) / 2];
}

function encodeMeals(mealIds, vocab) {
  const v = new Array(vocab.size).fill(0);
  for (const id of mealIds || []) {
    const idx = vocab.idToIndex.get(id);
    if (idx !== undefined) v[idx] = 1;
  }
  return v;
}

// Encodes a single meal-slot record. When includeMeals is false the meal slots
// are zeroed — used for the current/predicted slot whose meal is still unknown.
export function encodeDay(record, vocab, { includeMeals = true } = {}) {
  return [
    ...encodeWeather(record.weather),
    ...encodeOccasion(record.specialOccasion),
    ...encodeTimeOfDay(record.mealTime),
    ...(includeMeals ? encodeMeals(record.meals, vocab) : new Array(vocab.size).fill(0)),
  ];
}

// Multi-hot label normalised to a probability distribution, so that a slot with
// several chosen meals spreads its probability mass evenly across them.
export function mealsToDistribution(mealIds, vocab) {
  const v = new Array(vocab.size).fill(0);
  let count = 0;
  for (const id of mealIds || []) {
    const idx = vocab.idToIndex.get(id);
    if (idx !== undefined) {
      v[idx] = 1;
      count++;
    }
  }
  if (count > 0) for (let i = 0; i < v.length; i++) v[i] /= count;
  return v;
}

// Chronological order for slot records: by date, then breakfast < lunch < dinner.
export function compareRecords(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (TIME_ORDER.get(a.mealTime) ?? 0) - (TIME_ORDER.get(b.mealTime) ?? 0);
}

// Builds a [SEQUENCE_LENGTH][featuresPerDay] sequence ending at currentRecord.
// `history` is the list of fully-known past slot records (any order). The current
// slot's questionnaire answers (incl. time of day) are included but its meal is
// masked. The sequence is front-padded with zero vectors (ignored by Masking).
export function buildSequence(history, currentRecord, vocab) {
  const fpd = featuresPerDay(vocab);
  const sorted = [...history].sort(compareRecords);
  const encoded = sorted.map((d) => encodeDay(d, vocab, { includeMeals: true }));
  encoded.push(encodeDay(currentRecord, vocab, { includeMeals: false }));

  let seq = encoded;
  if (seq.length > SEQUENCE_LENGTH) seq = seq.slice(seq.length - SEQUENCE_LENGTH);
  while (seq.length < SEQUENCE_LENGTH) seq.unshift(new Array(fpd).fill(0));
  return seq;
}

// Turns the full history into supervised (sequence -> distribution) pairs.
// For every slot record that has chosen meals, the sequence ends at that record
// with its meal masked, and the label is that record's meal distribution.
export function buildTrainingData(history, vocab) {
  const sorted = [...history].sort(compareRecords);
  const samples = [];
  const labels = [];
  for (let t = 0; t < sorted.length; t++) {
    const record = sorted[t];
    if (!record.meals || record.meals.length === 0) continue;
    const past = sorted.slice(0, t);
    const currentRecord = {
      weather: record.weather,
      specialOccasion: record.specialOccasion,
      mealTime: record.mealTime,
      meals: [],
    };
    samples.push(buildSequence(past, currentRecord, vocab));
    labels.push(mealsToDistribution(record.meals, vocab));
  }
  return { samples, labels };
}
