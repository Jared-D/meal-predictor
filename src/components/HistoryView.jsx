import { useState } from 'react';
import { formatDate } from '../utils/date';
import { WEATHER_OPTIONS, MEAL_TIMES } from '../ml/encoding';

const WEATHER_ICON = { hot: '🔥', mild: '⛅', cold: '❄️' };
const MEAL_TIME_ICON = { breakfast: '🌅', lunch: '🥪', dinner: '🌙' };

// History list (per date + meal time) plus the model-training controls.
export default function HistoryView({ meals, history, predictor, recordMany, deleteSlot }) {
  const [training, setTraining] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState(null);

  const mealName = (id) => meals.find((m) => m.id === id)?.name || `#${id}`;
  const slotsWithMeals = history.filter((d) => d.meals && d.meals.length > 0).length;

  const handleTrain = async () => {
    setTraining(true);
    setMessage(null);
    try {
      const result = await predictor.train(history);
      setMessage(
        result.trained
          ? `Model trained on ${result.samples} meal slot${result.samples === 1 ? '' : 's'} of history.`
          : 'Not enough history yet — log some meals first.',
      );
    } catch (err) {
      setMessage(err.message || 'Training failed');
    } finally {
      setTraining(false);
    }
  };

  // Generates ~120 days × 3 slots of plausible history so the model has something
  // to learn from. Each meal time has its own characteristic foods, and dinner
  // additionally varies with weather / special occasions.
  const handleSeed = async () => {
    if (meals.length === 0) return;
    setSeeding(true);
    setMessage(null);
    try {
      const pick = (names) => {
        const pool = meals.filter((m) => names.some((n) => m.name.includes(n)));
        const list = pool.length ? pool : meals;
        return list[Math.floor(Math.random() * list.length)].id;
      };
      const mealForSlot = (mealTime, weather, special) => {
        if (mealTime === 'breakfast') return pick(['Pancakes', 'Oatmeal', 'Bacon']);
        if (mealTime === 'lunch') return pick(['Salad', 'Burrito', 'Mac', 'Soup']);
        // dinner
        if (special) return pick(['Pizza', 'Sushi', 'Roast', 'Lasagna']);
        if (weather === 'cold') return pick(['Curry', 'Soup', 'Roast']);
        if (weather === 'hot') return pick(['Sushi', 'Tacos', 'Salad']);
        return pick(['Spaghetti', 'Chicken', 'Burger', 'Stir Fry']);
      };

      const entries = [];
      for (let i = 120; i >= 1; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const date = d.toISOString().slice(0, 10);
        const weather = WEATHER_OPTIONS[Math.floor(Math.random() * WEATHER_OPTIONS.length)];
        const specialOccasion = Math.random() < 0.1;
        for (const mealTime of MEAL_TIMES) {
          entries.push({
            date,
            mealTime,
            weather,
            specialOccasion,
            meals: [mealForSlot(mealTime, weather, specialOccasion)],
          });
        }
      }
      await recordMany(entries);
      setMessage(`Generated ${entries.length} meal slots of sample history. Now train the model.`);
    } catch (err) {
      setMessage(err.message || 'Could not seed history');
    } finally {
      setSeeding(false);
    }
  };

  const { status, progress, lastTrained, trainedSamples } = predictor;

  return (
    <section className="panel">
      <div className="panel-head">
        <h1>History &amp; training</h1>
        <p className="muted">
          {history.length} meal slot{history.length === 1 ? '' : 's'} recorded · {slotsWithMeals}{' '}
          with meals
        </p>
      </div>

      <div className="train-box">
        <div className="train-status">
          <strong>Model:</strong>{' '}
          {status === 'ready' ? (
            <span className="badge badge--model">Trained</span>
          ) : status === 'training' ? (
            <span className="badge">Training…</span>
          ) : status === 'loading' ? (
            <span className="badge">Loading…</span>
          ) : (
            <span className="badge badge--fallback">Not trained (using popularity)</span>
          )}
          {lastTrained && (
            <span className="muted">
              {' '}
              · last trained {new Date(lastTrained).toLocaleString()} on {trainedSamples} samples
            </span>
          )}
        </div>

        {progress && (
          <div className="progress">
            <div
              className="progress-fill"
              style={{ width: `${(progress.epoch / progress.total) * 100}%` }}
            />
            <span className="progress-label">
              Epoch {progress.epoch}/{progress.total}
              {progress.loss != null ? ` · loss ${progress.loss.toFixed(4)}` : ''}
            </span>
          </div>
        )}

        <div className="train-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleTrain}
            disabled={training || slotsWithMeals === 0}
          >
            {training ? 'Training…' : 'Train / update model'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleSeed}
            disabled={seeding}
            title="Generate demo history to try the model"
          >
            {seeding ? 'Generating…' : 'Generate sample history'}
          </button>
        </div>
        {message && <div className="note">{message}</div>}
      </div>

      <ul className="history-list">
        {[...history].reverse().map((record) => (
          <li key={`${record.date}__${record.mealTime}`} className="history-item">
            <div className="history-main">
              <span className="history-date">
                {MEAL_TIME_ICON[record.mealTime]} {formatDate(record.date)} ·{' '}
                <span className="history-slot">{record.mealTime}</span>
              </span>
              <span className="history-meta">
                {WEATHER_ICON[record.weather] || ''} {record.weather}
                {record.specialOccasion ? ' · 🎉 special' : ''}
              </span>
              <span className="history-meals">
                {record.meals && record.meals.length ? record.meals.map(mealName).join(', ') : '—'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn--danger btn--small"
              onClick={() => deleteSlot(record.date, record.mealTime)}
            >
              Delete
            </button>
          </li>
        ))}
        {history.length === 0 && (
          <li className="muted">No history yet. Log a meal to get started.</li>
        )}
      </ul>
    </section>
  );
}
