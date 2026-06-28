import { useMemo, useState } from 'react';
import Questionnaire from './Questionnaire';
import PredictionResults from './PredictionResults';
import { todayISO, formatDate } from '../utils/date';

// Drives the daily prediction flow: questionnaire -> predictions -> selection.
export default function PredictPanel({ meals, history, predictor, recordDay, addMeal }) {
  const today = todayISO();
  const [answers, setAnswers] = useState({ weather: 'mild', specialOccasion: false });
  const [predictions, setPredictions] = useState(null);
  const [source, setSource] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const mealName = useMemo(() => {
    const map = new Map(meals.map((m) => [m.id, m.name]));
    return (id) => map.get(id) || `#${id}`;
  }, [meals]);

  const alreadyToday = history.find((d) => d.date === today);

  const handlePredict = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const currentDay = { date: today, ...answers, meals: [] };
      const { predictions: preds, source: src } = await predictor.getPredictions(
        history,
        currentDay,
        10,
      );
      setPredictions(preds);
      setSource(src);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Prediction failed');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const handleAddCustom = async (name) => {
    setError(null);
    try {
      const { meal } = await addMeal(name);
      // Surface the custom meal at the top of the list and pre-select it.
      setPredictions((cur) => {
        const without = (cur || []).filter((p) => p.id !== meal.id);
        return [{ id: meal.id, name: meal.name, score: 0 }, ...without];
      });
      setSelected((cur) => (cur.includes(meal.id) ? cur : [...cur, meal.id]));
    } catch (err) {
      setError(err.message || 'Could not add meal');
    }
  };

  const handleConfirm = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await recordDay({
        date: today,
        weather: answers.weather,
        specialOccasion: answers.specialOccasion,
        meals: selected,
      });
      setSaved(true);
      setPredictions(null);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h1>What's for your next meal?</h1>
        <p className="muted">{formatDate(today)}</p>
      </div>

      {alreadyToday && alreadyToday.meals.length > 0 && (
        <div className="note">
          Already logged today: {alreadyToday.meals.map(mealName).join(', ')}. New picks will be
          added.
        </div>
      )}

      <Questionnaire answers={answers} onChange={setAnswers} disabled={busy} />

      <button type="button" className="btn btn--primary btn--block" onClick={handlePredict} disabled={busy}>
        {busy ? 'Predicting…' : predictions ? 'Re-run prediction' : 'Get my top 10 predictions'}
      </button>

      {error && <div className="error">{error}</div>}
      {saved && <div className="note note--success">Saved to today's history. 🎉</div>}

      {predictions && (
        <PredictionResults
          predictions={predictions}
          source={source}
          selected={selected}
          onToggle={toggle}
          onConfirm={handleConfirm}
          onAddCustom={handleAddCustom}
          saving={saving}
        />
      )}
    </section>
  );
}
