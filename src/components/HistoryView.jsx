import { useState } from 'react';
import { formatDate } from '../utils/date';
import { WEATHER_OPTIONS } from '../ml/encoding';

const WEATHER_ICON = { hot: '🔥', mild: '⛅', cold: '❄️' };

// History list plus the model-training controls (training is driven by history).
export default function HistoryView({ meals, history, predictor, recordDay, deleteDay }) {
  const [training, setTraining] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState(null);

  const mealName = (id) => meals.find((m) => m.id === id)?.name || `#${id}`;
  const daysWithMeals = history.filter((d) => d.meals && d.meals.length > 0).length;

  const handleTrain = async () => {
    setTraining(true);
    setMessage(null);
    try {
      const result = await predictor.train(history);
      setMessage(
        result.trained
          ? `Model trained on ${result.samples} day${result.samples === 1 ? '' : 's'} of history.`
          : 'Not enough history yet — log some meals first.',
      );
    } catch (err) {
      setMessage(err.message || 'Training failed');
    } finally {
      setTraining(false);
    }
  };

  // Generates ~120 days of plausible history so the model has something to learn
  // from in a demo. Patterns: cold -> soups/curry, hot -> salads/sushi,
  // special occasions -> pizza/sushi/roast.
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
      for (let i = 120; i >= 1; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const date = d.toISOString().slice(0, 10);
        const weather = WEATHER_OPTIONS[Math.floor(Math.random() * 3)];
        const specialOccasion = Math.random() < 0.1;
        let mealId;
        if (specialOccasion) mealId = pick(['Pizza', 'Sushi', 'Roast', 'Lasagna']);
        else if (weather === 'cold') mealId = pick(['Soup', 'Curry', 'Oatmeal', 'Mac']);
        else if (weather === 'hot') mealId = pick(['Salad', 'Sushi', 'Tacos']);
        else mealId = pick(['Spaghetti', 'Chicken', 'Burger', 'Stir Fry']);
        await recordDay({ date, weather, specialOccasion, meals: [mealId] });
      }
      setMessage('Generated 120 days of sample history. Now train the model.');
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
          {history.length} day{history.length === 1 ? '' : 's'} recorded · {daysWithMeals} with meals
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
            disabled={training || daysWithMeals === 0}
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
        {[...history].reverse().map((day) => (
          <li key={day.date} className="history-item">
            <div className="history-main">
              <span className="history-date">{formatDate(day.date)}</span>
              <span className="history-meta">
                {WEATHER_ICON[day.weather] || ''} {day.weather}
                {day.specialOccasion ? ' · 🎉 special' : ''}
              </span>
              <span className="history-meals">
                {day.meals && day.meals.length ? day.meals.map(mealName).join(', ') : '—'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn--danger btn--small"
              onClick={() => deleteDay(day.date)}
            >
              Delete
            </button>
          </li>
        ))}
        {history.length === 0 && <li className="muted">No history yet. Log a meal to get started.</li>}
      </ul>
    </section>
  );
}
