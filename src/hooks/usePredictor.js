import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildVocab } from '../ml/encoding';
import {
  loadModel,
  trainModel,
  predictWithModel,
  popularityRanking,
} from '../ml/model';
import * as storage from '../db/storage';

// Owns the TensorFlow.js model lifecycle: loading a persisted model, retraining,
// and producing predictions. The vocabulary is derived from the meal list, so
// any change to the meals invalidates the cached model.
export function usePredictor(meals) {
  const vocab = useMemo(() => buildVocab(meals), [meals]);
  const modelRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | training | unavailable
  const [progress, setProgress] = useState(null); // { epoch, total, loss }
  const [lastTrained, setLastTrained] = useState(null);
  const [trainedSamples, setTrainedSamples] = useState(0);

  // Try to restore a previously trained, still-compatible model.
  useEffect(() => {
    let active = true;
    setStatus('loading');
    (async () => {
      if (modelRef.current) {
        modelRef.current.dispose();
        modelRef.current = null;
      }
      const model = await loadModel(vocab);
      const meta = await storage.getMeta('modelMeta');
      if (!active) {
        model?.dispose();
        return;
      }
      modelRef.current = model;
      setStatus(model ? 'ready' : 'unavailable');
      if (model && meta) {
        setLastTrained(meta.trainedAt || null);
        setTrainedSamples(meta.samples || 0);
      } else {
        setLastTrained(null);
        setTrainedSamples(0);
      }
    })();
    return () => {
      active = false;
    };
  }, [vocab]);

  const train = useCallback(
    async (history) => {
      setStatus('training');
      setProgress({ epoch: 0, total: 40, loss: null });
      try {
        const result = await trainModel(history, vocab, {
          epochs: 40,
          onEpoch: (epoch, logs, total) =>
            setProgress({ epoch: epoch + 1, total, loss: logs?.loss ?? null }),
        });
        if (!result.trained) {
          setStatus(modelRef.current ? 'ready' : 'unavailable');
          return result;
        }
        if (modelRef.current && modelRef.current !== result.model) {
          modelRef.current.dispose();
        }
        modelRef.current = result.model;
        const trainedAt = new Date().toISOString();
        await storage.setMeta('modelMeta', {
          trainedAt,
          samples: result.samples,
          vocabSize: result.vocabSize,
        });
        setLastTrained(trainedAt);
        setTrainedSamples(result.samples);
        setStatus('ready');
        return result;
      } catch (err) {
        setStatus(modelRef.current ? 'ready' : 'unavailable');
        throw err;
      } finally {
        setProgress(null);
      }
    },
    [vocab],
  );

  // Returns { predictions, source } for the current slot (currentRecord carries
  // the chosen mealTime, so its cyclical time-of-day feature drives a meal-time-
  // specific prediction). Uses the model when available, else a popularity-based
  // cold-start ranking.
  const getPredictions = useCallback(
    async (history, currentRecord, topK = 10) => {
      if (modelRef.current) {
        const predictions = await predictWithModel(
          modelRef.current,
          history,
          currentRecord,
          vocab,
          topK,
        );
        return { predictions, source: 'model' };
      }
      return {
        predictions: popularityRanking(history, currentRecord, vocab, topK),
        source: 'fallback',
      };
    },
    [vocab],
  );

  return {
    status,
    progress,
    lastTrained,
    trainedSamples,
    hasModel: status === 'ready',
    train,
    getPredictions,
  };
}
