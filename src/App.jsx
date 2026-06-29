import { useCallback, useState } from 'react';
import { useMeals } from './hooks/useMeals';
import { useHistory } from './hooks/useHistory';
import { usePredictor } from './hooks/usePredictor';
import PredictPanel from './components/PredictPanel';
import MealManager from './components/MealManager';
import HistoryView from './components/HistoryView';
import AppSettings from './components/AppSettings';

const TABS = [
  { id: 'predict', label: 'Predict' },
  { id: 'history', label: 'History' },
  { id: 'meals', label: 'Meals' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState('predict');
  const { meals, loading: mealsLoading, addMeal, removeMeal, reloadMeals } = useMeals();
  const { history, loading: historyLoading, recordSlot, recordMany, deleteSlot, refresh: reloadHistory } = useHistory();
  const predictor = usePredictor(meals);

  const loading = mealsLoading || historyLoading;

  const handleImportDone = useCallback(async () => {
    await Promise.all([reloadMeals(), reloadHistory()]);
  }, [reloadMeals, reloadHistory]);

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
                recordSlot={recordSlot}
                addMeal={addMeal}
              />
            )}
            {tab === 'history' && (
              <HistoryView
                meals={meals}
                history={history}
                predictor={predictor}
                recordSlot={recordSlot}
                recordMany={recordMany}
                deleteSlot={deleteSlot}
                addMeal={addMeal}
              />
            )}
            {tab === 'meals' && (
              <MealManager meals={meals} addMeal={addMeal} removeMeal={removeMeal} />
            )}
            {tab === 'settings' && (
              <AppSettings meals={meals} history={history} onImportDone={handleImportDone} />
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
