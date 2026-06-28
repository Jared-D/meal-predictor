import { useCallback, useEffect, useState } from 'react';
import * as storage from '../db/storage';

// Loads and manages the day-by-day meal history.
export function useHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const days = await storage.getHistory();
    setHistory(days);
    return days;
  }, []);

  useEffect(() => {
    let active = true;
    storage.getHistory().then((days) => {
      if (active) {
        setHistory(days);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Merges chosen meals + answers into the given date's record.
  const recordDay = useCallback(
    async (entry) => {
      await storage.recordDay(entry);
      return refresh();
    },
    [refresh],
  );

  const deleteDay = useCallback(
    async (date) => {
      await storage.deleteDay(date);
      return refresh();
    },
    [refresh],
  );

  return { history, loading, recordDay, deleteDay, refresh };
}
