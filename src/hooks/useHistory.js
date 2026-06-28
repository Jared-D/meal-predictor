import { useCallback, useEffect, useState } from 'react';
import * as storage from '../db/storage';

// Loads and manages the per-slot (date + meal time) meal history.
export function useHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const records = await storage.getHistory();
    setHistory(records);
    return records;
  }, []);

  useEffect(() => {
    let active = true;
    storage.getHistory().then((records) => {
      if (active) {
        setHistory(records);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Merges chosen meals + answers into one (date, mealTime) slot.
  const recordSlot = useCallback(
    async (entry) => {
      await storage.recordSlot(entry);
      return refresh();
    },
    [refresh],
  );

  // Bulk write (seeding) with a single refresh at the end.
  const recordMany = useCallback(
    async (entries) => {
      const records = await storage.recordManySlots(entries);
      setHistory(records);
      return records;
    },
    [],
  );

  const deleteSlot = useCallback(
    async (date, mealTime) => {
      await storage.deleteSlot(date, mealTime);
      return refresh();
    },
    [refresh],
  );

  return { history, loading, recordSlot, recordMany, deleteSlot, refresh };
}
