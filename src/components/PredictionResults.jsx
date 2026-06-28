import { useState } from 'react';

// Shows the top predictions, lets the user select one or more, and offers a
// free-text fallback to enter a meal that wasn't predicted.
export default function PredictionResults({
  predictions,
  source,
  mealTime,
  selected,
  onToggle,
  onConfirm,
  onAddCustom,
  saving,
}) {
  const [custom, setCustom] = useState('');

  const maxScore = predictions.reduce((m, p) => Math.max(m, p.score), 0) || 1;

  const submitCustom = async (e) => {
    e.preventDefault();
    const name = custom.trim();
    if (!name) return;
    await onAddCustom(name);
    setCustom('');
  };

  return (
    <div className="results">
      <div className="results-header">
        <h2>
          Top {predictions.length} {mealTime} predictions
        </h2>
        <span className={`badge badge--${source === 'model' ? 'model' : 'fallback'}`}>
          {source === 'model' ? 'TensorFlow model' : 'Popularity (cold start)'}
        </span>
      </div>

      <ul className="prediction-list">
        {predictions.map((p, i) => {
          const isSelected = selected.includes(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`prediction ${isSelected ? 'prediction--selected' : ''}`}
                onClick={() => onToggle(p.id)}
              >
                <span className="prediction-rank">{i + 1}</span>
                <span className="prediction-name">{p.name}</span>
                <span className="prediction-bar">
                  <span
                    className="prediction-bar-fill"
                    style={{ width: `${Math.max(4, (p.score / maxScore) * 100)}%` }}
                  />
                </span>
                <span className="prediction-check">{isSelected ? '✓' : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <form className="custom-meal" onSubmit={submitCustom}>
        <label htmlFor="custom-meal-input">None of these? Enter your own:</label>
        <div className="custom-meal-row">
          <input
            id="custom-meal-input"
            type="text"
            placeholder="e.g. Mushroom Risotto"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button type="submit" className="btn btn--ghost">
            Add
          </button>
        </div>
      </form>

      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={selected.length === 0 || saving}
        onClick={onConfirm}
      >
        {saving
          ? 'Saving…'
          : `Confirm ${selected.length || ''} meal${selected.length === 1 ? '' : 's'} for today`}
      </button>
    </div>
  );
}
