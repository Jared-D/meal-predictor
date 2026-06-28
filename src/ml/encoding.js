// One-hot encoding utilities that turn day records into the fixed-shape
// tensors the model consumes.
//
// Each day is encoded as a feature vector:
//   [ weather(3) | specialOccasion(2) | meals(M) ]
// and a model input is a sequence of SEQUENCE_LENGTH such vectors
// (the past 365 days, including the current session day).

export const WEATHER_OPTIONS = ['hot', 'mild', 'cold'];
export const SEQUENCE_LENGTH = 365;

// weather one-hot (3) + special-occasion one-hot (2)
export const QUESTION_FEATURES = WEATHER_OPTIONS.length + 2;

export const featuresPerDay = (vocab) => QUESTION_FEATURES + vocab.size;

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

function encodeMeals(mealIds, vocab) {
  const v = new Array(vocab.size).fill(0);
  for (const id of mealIds || []) {
    const idx = vocab.idToIndex.get(id);
    if (idx !== undefined) v[idx] = 1;
  }
  return v;
}

// Encodes a single day. When includeMeals is false the meal slots are zeroed —
// used for the current/predicted day whose meal is still unknown.
export function encodeDay(day, vocab, { includeMeals = true } = {}) {
  return [
    ...encodeWeather(day.weather),
    ...encodeOccasion(day.specialOccasion),
    ...(includeMeals ? encodeMeals(day.meals, vocab) : new Array(vocab.size).fill(0)),
  ];
}

// Multi-hot label normalised to a probability distribution, so that a day with
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

// Builds a [SEQUENCE_LENGTH][featuresPerDay] sequence ending at currentDay.
// `history` is the list of fully-known past days (ascending). The current day's
// questionnaire answers are included but its meal is masked. The sequence is
// front-padded with zero vectors (which the model's Masking layer ignores).
export function buildSequence(history, currentDay, vocab) {
  const fpd = featuresPerDay(vocab);
  const encoded = history.map((d) => encodeDay(d, vocab, { includeMeals: true }));
  encoded.push(encodeDay(currentDay, vocab, { includeMeals: false }));

  let seq = encoded;
  if (seq.length > SEQUENCE_LENGTH) seq = seq.slice(seq.length - SEQUENCE_LENGTH);
  while (seq.length < SEQUENCE_LENGTH) seq.unshift(new Array(fpd).fill(0));
  return seq;
}

// Turns the full history into supervised (sequence -> distribution) pairs.
// For every day that has chosen meals, the sequence ends at that day with its
// meal masked, and the label is that day's meal distribution.
export function buildTrainingData(history, vocab) {
  const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
  const samples = [];
  const labels = [];
  for (let t = 0; t < sorted.length; t++) {
    const day = sorted[t];
    if (!day.meals || day.meals.length === 0) continue;
    const past = sorted.slice(0, t);
    const currentDay = { weather: day.weather, specialOccasion: day.specialOccasion, meals: [] };
    samples.push(buildSequence(past, currentDay, vocab));
    labels.push(mealsToDistribution(day.meals, vocab));
  }
  return { samples, labels };
}
