import { useCallback, useEffect, useState } from 'react';
import * as storage from '../db/storage';

// Loads and manages the meal database (seeded from presets on first run).
export function useMeals() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    storage.getMeals().then((m) => {
      if (active) {
        setMeals(m);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const addMeal = useCallback(async (name) => {
    const { meals: updated, meal, created } = await storage.addMeal(name);
    setMeals(updated);
    return { meal, created };
  }, []);

  const removeMeal = useCallback(async (id) => {
    const updated = await storage.removeMeal(id);
    setMeals(updated);
  }, []);

  return { meals, loading, addMeal, removeMeal };
}
