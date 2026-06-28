import * as tf from '@tensorflow/tfjs';
import { SEQUENCE_LENGTH, featuresPerDay, buildSequence, buildTrainingData } from './encoding';

const MODEL_KEY = 'indexeddb://meal-predictor-model';

// Builds a recurrent model over the meal-slot sequence (365 days × 3 slots). The
// Masking layer skips the zero-padded leading slots, the LSTM summarises the
// temporal pattern, and a softmax head produces a probability for every meal.
export function buildModel(fpd, numMeals) {
  const model = tf.sequential();
  model.add(tf.layers.masking({ maskValue: 0, inputShape: [SEQUENCE_LENGTH, fpd] }));
  model.add(tf.layers.lstm({ units: 48, returnSequences: false }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: Math.max(32, numMeals), activation: 'relu' }));
  model.add(tf.layers.dense({ units: numMeals, activation: 'softmax' }));
  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });
  return model;
}

// Trains a fresh model from the full history and persists it to IndexedDB.
// Returns { trained, model, samples, reason }.
export async function trainModel(history, vocab, { epochs = 40, onEpoch } = {}) {
  const { samples, labels } = buildTrainingData(history, vocab);
  if (samples.length === 0) {
    return { trained: false, model: null, samples: 0, reason: 'no-data' };
  }

  const fpd = featuresPerDay(vocab);
  const model = buildModel(fpd, vocab.size);
  const xs = tf.tensor3d(samples);
  const ys = tf.tensor2d(labels);

  try {
    await model.fit(xs, ys, {
      epochs,
      batchSize: Math.min(16, samples.length),
      shuffle: true,
      callbacks: onEpoch
        ? { onEpochEnd: (epoch, logs) => onEpoch(epoch, logs, epochs) }
        : undefined,
    });
    await model.save(MODEL_KEY);
    return { trained: true, model, samples: samples.length, vocabSize: vocab.size };
  } finally {
    xs.dispose();
    ys.dispose();
  }
}

// Loads a persisted model, but only if its input/output shape still matches the
// current vocabulary and feature layout (adding/removing meals — or a change to
// the encoding — invalidates the old model).
export async function loadModel(vocab) {
  try {
    const model = await tf.loadLayersModel(MODEL_KEY);
    const outShape = model.outputs[0].shape;
    const outUnits = outShape[outShape.length - 1];
    const inShape = model.inputs[0].shape; // [null, SEQUENCE_LENGTH, fpd]
    const okInput = inShape[1] === SEQUENCE_LENGTH && inShape[2] === featuresPerDay(vocab);
    if (outUnits !== vocab.size || !okInput) {
      model.dispose();
      return null;
    }
    return model;
  } catch {
    return null;
  }
}

// Runs the model for the current slot and returns the topK ranked meals.
export async function predictWithModel(model, history, currentRecord, vocab, topK = 10) {
  const seq = buildSequence(history, currentRecord, vocab);
  const input = tf.tensor3d([seq]);
  let probs;
  try {
    const out = model.predict(input);
    probs = await out.data();
    out.dispose();
  } finally {
    input.dispose();
  }
  return rank(vocab.meals, (m, i) => probs[i], topK);
}

// Cold-start / fallback ranking used when there is no trained model yet. Scores
// meals by frequency, with a boost for meals previously eaten under matching
// conditions (same meal time / weather / special-occasion flag). The meal-time
// match keeps cold-start predictions distinct per breakfast / lunch / dinner.
export function popularityRanking(history, currentRecord, vocab, topK = 10) {
  const total = new Map();
  const conditional = new Map();
  for (const record of history) {
    const timeMatch = record.mealTime === currentRecord.mealTime;
    const weatherMatch = record.weather === currentRecord.weather;
    const occasionMatch = !!record.specialOccasion === !!currentRecord.specialOccasion;
    for (const id of record.meals || []) {
      total.set(id, (total.get(id) || 0) + 1);
      if (timeMatch) conditional.set(id, (conditional.get(id) || 0) + 2);
      if (weatherMatch) conditional.set(id, (conditional.get(id) || 0) + 1);
      if (occasionMatch) conditional.set(id, (conditional.get(id) || 0) + 1);
    }
  }
  return rank(vocab.meals, (m) => (total.get(m.id) || 0) + 2 * (conditional.get(m.id) || 0), topK);
}

function rank(meals, scoreFn, topK) {
  return meals
    .map((m, i) => ({ id: m.id, name: m.name, score: scoreFn(m, i) }))
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, topK);
}
