import { useState } from 'react';
import { useMeals } from './hooks/useMeals';
import { useHistory } from './hooks/useHistory';
import { usePredictor } from './hooks/usePredictor';
import PredictPanel from './components/PredictPanel';
import MealManager from './components/MealManager';
import HistoryView from './components/HistoryView';

const TABS = [
  { id: 'predict', label: 'Predict' },
  { id: 'history', label: 'History' },
  { id: 'meals', label: 'Meals' },
];

export default function App() {
  const [tab, setTab] = useState('predict');
  const { meals, loading: mealsLoading, addMeal, removeMeal } = useMeals();
  const { history, loading: historyLoading, recordDay, deleteDay } = useHistory();
  const predictor = usePredictor(meals);

  const loading = mealsLoading || historyLoading;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <img src="/favicon.svg" alt="" width="28" height="28" />
          <span>Meal Predictor</span>
        </div>
      </header>

      <main className="app-main">
        {loading ? (
          <div className="panel">
            <p className="muted">Loading your data…</p>
          </div>
        ) : (
          <>
            {tab === 'predict' && (
              <PredictPanel
                meals={meals}
                history={history}
                predictor={predictor}
                recordDay={recordDay}
                addMeal={addMeal}
              />
            )}
            {tab === 'history' && (
              <HistoryView
                meals={meals}
                history={history}
                predictor={predictor}
                recordDay={recordDay}
                deleteDay={deleteDay}
              />
            )}
            {tab === 'meals' && (
              <MealManager meals={meals} addMeal={addMeal} removeMeal={removeMeal} />
            )}
          </>
        )}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tabbar-btn ${tab === t.id ? 'tabbar-btn--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
