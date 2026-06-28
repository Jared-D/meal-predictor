import { useMemo, useState } from 'react';
import Questionnaire from './Questionnaire';
import { todayISO, defaultMealTime } from '../utils/date';

const emptyForm = () => ({
  date: todayISO(),
  mealTime: defaultMealTime(),
  weather: 'mild',
  specialOccasion: false,
});

// Collapsible form for back-filling a meal slot the user ate but never logged.
// Reuses the Questionnaire (meal time / weather / special occasion) and adds a
// date picker plus a meal selector, then writes the slot via recordSlot (which
// merges with any existing entry for that date + meal time).
export default function AddHistoryEntry({ meals, recordSlot, addMeal }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState([]);
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const today = todayISO();
  const mealName = useMemo(() => {
    const map = new Map(meals.map((m) => [m.id, m.name]));
    return (id) => map.get(id) || `#${id}`;
  }, [meals]);

  const unselected = meals.filter((m) => !selected.includes(m.id));

  const reset = () => {
    setForm(emptyForm());
    setSelected([]);
    setCustomName('');
    setError(null);
  };

  const addMealId = (id) => {
    setSelected((cur) => (cur.includes(id) ? cur : [...cur, id]));
  };

  const handleSelect = (e) => {
    const id = Number(e.target.value);
    if (id) addMealId(id);
    e.target.value = '';
  };

  const handleAddCustom = async () => {
    const name = customName.trim();
    if (!name) return;
    setError(null);
    try {
      const { meal } = await addMeal(name);
      addMealId(meal.id);
      setCustomName('');
    } catch (err) {
      setError(err.message || 'Could not add meal');
    }
  };

  const handleSave = async () => {
    if (!form.date) {
      setError('Pick a date.');
      return;
    }
    if (form.date > today) {
      setError("Can't add a meal in the future.");
      return;
    }
    if (selected.length === 0) {
      setError('Add at least one meal.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await recordSlot({
        date: form.date,
        mealTime: form.mealTime,
        weather: form.weather,
        specialOccasion: form.specialOccasion,
        meals: selected,
      });
      setMessage(
        `Added ${selected.map(mealName).join(', ')} to ${form.mealTime} on ${form.date}.`,
      );
      reset();
    } catch (err) {
      setError(err.message || 'Could not save entry');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="add-history">
        <button type="button" className="btn btn--ghost" onClick={() => setOpen(true)}>
          + Add a past meal
        </button>
        {message && <div className="note note--success">{message}</div>}
      </div>
    );
  }

  return (
    <div className="add-history add-history--open">
      <div className="add-history-head">
        <strong>Add a past meal</strong>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancel
        </button>
      </div>

      <label className="field">
        <span className="field-label">Date</span>
        <input
          type="date"
          value={form.date}
          max={today}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
      </label>

      <Questionnaire answers={form} onChange={setForm} disabled={saving} />

      <fieldset disabled={saving}>
        <legend>What did you eat?</legend>
        {selected.length > 0 && (
          <div className="choice-row">
            {selected.map((id) => (
              <button
                key={id}
                type="button"
                className="chip chip--active"
                onClick={() => setSelected((cur) => cur.filter((x) => x !== id))}
                title="Remove"
              >
                {mealName(id)} ✕
              </button>
            ))}
          </div>
        )}
        <div className="add-meal">
          <select className="meal-select" defaultValue="" onChange={handleSelect}>
            <option value="" disabled>
              {unselected.length ? 'Choose a meal…' : 'All meals added'}
            </option>
            {unselected.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="add-meal">
          <input
            type="text"
            placeholder="…or type a new meal"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustom();
              }
            }}
          />
          <button type="button" className="btn btn--ghost" onClick={handleAddCustom}>
            Add
          </button>
        </div>
      </fieldset>

      {error && <div className="error">{error}</div>}

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Add to history'}
      </button>
    </div>
  );
}
