import { useState } from 'react';

// Secondary UI for adding / removing meals from the database.
export default function MealManager({ meals, addMeal, removeMeal, onBack }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const { meal, created } = await addMeal(trimmed);
      setMessage(created ? `Added “${meal.name}”.` : `“${meal.name}” already exists.`);
      setName('');
    } catch (err) {
      setMessage(err.message || 'Could not add meal');
    }
  };

  return (
    <section className="panel">
      {onBack && (
        <button type="button" className="btn btn--ghost btn--small back-btn" onClick={onBack}>
          ← Settings
        </button>
      )}
      <div className="panel-head">
        <h1>Manage meals</h1>
        <p className="muted">{meals.length} meals in your database</p>
      </div>

      <form className="add-meal" onSubmit={submit}>
        <input
          type="text"
          placeholder="Add a meal, e.g. Falafel Wrap"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn--primary">
          Add
        </button>
      </form>

      {message && <div className="note">{message}</div>}

      <ul className="meal-list">
        {meals.map((m) => (
          <li key={m.id} className="meal-item">
            <span className="meal-item-name">{m.name}</span>
            <button
              type="button"
              className="btn btn--danger btn--small"
              onClick={() => removeMeal(m.id)}
              aria-label={`Remove ${m.name}`}
            >
              Remove
            </button>
          </li>
        ))}
        {meals.length === 0 && <li className="muted">No meals yet — add one above.</li>}
      </ul>
    </section>
  );
}
