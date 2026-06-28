import { WEATHER_OPTIONS, MEAL_TIMES } from '../ml/encoding';

const WEATHER_LABELS = { hot: '🔥 Hot', mild: '⛅ Mild', cold: '❄️ Cold' };
const MEAL_TIME_LABELS = {
  breakfast: '🌅 Breakfast',
  lunch: '🥪 Lunch',
  dinner: '🌙 Dinner',
};

// Pre-prediction questions: which meal, weather, and special occasion.
export default function Questionnaire({ answers, onChange, disabled }) {
  return (
    <div className="questionnaire">
      <fieldset disabled={disabled}>
        <legend>Which meal are you planning?</legend>
        <div className="choice-row">
          {MEAL_TIMES.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${answers.mealTime === t ? 'chip--active' : ''}`}
              onClick={() => onChange({ ...answers, mealTime: t })}
            >
              {MEAL_TIME_LABELS[t]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend>Has the weather been hot, mild, or cold?</legend>
        <div className="choice-row">
          {WEATHER_OPTIONS.map((w) => (
            <button
              key={w}
              type="button"
              className={`chip ${answers.weather === w ? 'chip--active' : ''}`}
              onClick={() => onChange({ ...answers, weather: w })}
            >
              {WEATHER_LABELS[w]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend>Is today a special occasion?</legend>
        <div className="choice-row">
          <button
            type="button"
            className={`chip ${!answers.specialOccasion ? 'chip--active' : ''}`}
            onClick={() => onChange({ ...answers, specialOccasion: false })}
          >
            No, a normal day
          </button>
          <button
            type="button"
            className={`chip ${answers.specialOccasion ? 'chip--active' : ''}`}
            onClick={() => onChange({ ...answers, specialOccasion: true })}
          >
            🎉 Yes, special
          </button>
        </div>
      </fieldset>
    </div>
  );
}
