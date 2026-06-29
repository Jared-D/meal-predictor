import { useRef, useState } from 'react';
import * as storage from '../db/storage';

export default function AppSettings({ meals, history, onImportDone, onManageMeals }) {
  const [status, setStatus] = useState(null);
  const fileRef = useRef();

  function handleExport() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      meals,
      history,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meal-predictor-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.meals) || !Array.isArray(data.history)) {
        setStatus({ error: 'Invalid file: missing meals or history arrays.' });
        return;
      }
      await storage.importAll(data);
      await onImportDone();
      setStatus({
        ok: `Imported ${data.meals.length} meal${data.meals.length !== 1 ? 's' : ''} and ${data.history.length} history entr${data.history.length !== 1 ? 'ies' : 'y'}.`,
      });
    } catch (err) {
      setStatus({ error: `Import failed: ${err.message ?? err}` });
    }
    e.target.value = '';
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h1>Settings</h1>
        <p className="muted">Manage your app data</p>
      </div>

      <section className="settings-section">
        <h2 className="settings-section-title">Meals</h2>

        <div className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">Manage meals</div>
            <div className="settings-row-desc">
              Add or remove meal choices from your database.
            </div>
          </div>
          <button type="button" className="btn btn--ghost btn--small" onClick={onManageMeals}>
            Open
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Data</h2>

        <div className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">Export</div>
            <div className="settings-row-desc">
              Download all meals and history as a JSON file.
            </div>
          </div>
          <button type="button" className="btn btn--ghost btn--small" onClick={handleExport}>
            Export
          </button>
        </div>

        <div className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">Import</div>
            <div className="settings-row-desc">
              Replace all data from a previously exported JSON file.
            </div>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => fileRef.current.click()}
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>

        {status?.ok && <p className="note note--success">{status.ok}</p>}
        {status?.error && <p className="error">{status.error}</p>}
      </section>
    </div>
  );
}
