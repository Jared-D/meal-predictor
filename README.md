# 🍽️ Meal Predictor

A **Progressive Web App** that predicts your next meal choice from your eating
history, using an on-device **TensorFlow.js** model. UI built with **React** +
**Vite**. All data and the trained model live entirely in your browser
(IndexedDB) — nothing is sent to a server.

## Requirements

- Node **v22.22.2**
- npm **10.9.7**

## Getting started

```bash
npm install
npm run dev      # start the dev server (PWA enabled in dev)
```

Open the printed URL (default http://localhost:5173).

```bash
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

> The model and TensorFlow.js run **client-side**, so use Chrome/Edge/Firefox.
> To try installability ("Add to Home Screen") use `npm run build && npm run preview`.

## How to use it

1. **Predict tab** — answer the two questions (weather, special occasion?) and
   tap **Get my top 10 predictions**. Select one or more meals you'll have, or
   type a meal of your own (it's added to your database). Confirm to log it to
   today's history.
2. **History tab** — see every recorded day. Use **Train / update model** to
   (re)train on your history. Use **Generate sample history** to create ~120
   days of demo data so you can see the model in action immediately.
3. **Meals tab** — add or remove meals from your database.

> First runs use a **popularity-based cold-start** ranking (badge: *Popularity*).
> Once you train, predictions come from the neural net (badge: *TensorFlow model*).

## How the model works

Data format for a meal:

```json
{ "id": 1, "name": "Spaghetti" }
```

Each recorded day:

```json
{ "date": "2026-06-28", "weather": "mild", "specialOccasion": false, "meals": [1, 3] }
```

### Encoding (`src/ml/encoding.js`)

Every day is one-hot encoded into a feature vector:

```
[ weather(3: hot/mild/cold) | specialOccasion(2) | meals(M one-hot) ]
```

A model input is a **sequence of the past 365 days** (`SEQUENCE_LENGTH`),
**including the current session day**. The current day's questionnaire answers
are included but its meal slots are masked (zeroed) — that's what we predict.
Shorter histories are front-padded with zero vectors.

### Model (`src/ml/model.js`)

```
Masking(0)  →  LSTM(48)  →  Dropout(0.2)  →  Dense(relu)  →  Dense(M, softmax)
input: [365, 5 + M]                                          output: P(meal)
```

- The **Masking** layer ignores the zero-padded leading days.
- The **LSTM** learns temporal patterns across the year.
- The **softmax** head yields a probability per meal; the UI shows the **top 10**.
- Days with multiple chosen meals become a normalised multi-hot target, spreading
  probability across the selected meals.

Training builds one `(sequence → distribution)` sample per historical day that
has meals, with that day's meal masked in the input. The trained model is saved
to IndexedDB (`indexeddb://meal-predictor-model`).

### Vocabulary changes

The model's input/output size depends on the number of meals. Adding or removing
a meal changes the vocabulary, so the cached model is automatically invalidated
and the app falls back to popularity ranking until you retrain.

## Project structure

```
src/
  data/presetMeals.js     preset meal database (seeds first run)
  db/storage.js           IndexedDB persistence (localforage)
  ml/encoding.js          one-hot encoding + sequence/training-data builders
  ml/model.js             build / train / load / predict (TensorFlow.js)
  hooks/                  useMeals, useHistory, usePredictor
  components/             Questionnaire, PredictionResults, PredictPanel,
                          MealManager, HistoryView
  App.jsx, main.jsx, index.css
```

## Notes

- PWA is configured via `vite-plugin-pwa` (auto-update service worker, web
  manifest, offline precache). TensorFlow.js chunks are large, so the Workbox
  cache size limit is raised in `vite.config.js`.
- Icons are SVG (`public/pwa-icon.svg`, `public/favicon.svg`).
