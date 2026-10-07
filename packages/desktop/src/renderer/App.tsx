import { useState } from 'react';

import { SettingsView } from './SettingsView.js';
import { ShareForm } from './ShareForm.js';
import { useDestinations } from './useDestinations.js';

export function App() {
  const destinations = useDestinations();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <main className="app">
      <header className="app-header">
        <h1>{showSettings ? 'Settings' : 'DevShare'}</h1>
        <button
          type="button"
          onClick={() => {
            setShowSettings((current) => !current);
          }}
        >
          {showSettings ? 'Back' : 'Settings'}
        </button>
      </header>

      {showSettings && <SettingsView />}

      {/* Hidden rather than removed while settings are open, so the draft is kept. */}
      <div className="share-view" hidden={showSettings}>
        {destinations.status === 'loading' && <p className="muted">Loading destinations…</p>}
        {destinations.status === 'error' && (
          <div className="error" role="alert">
            <p>{destinations.error.message}</p>
            {destinations.error.code === 'CONFIG_NOT_FOUND' && (
              <p>Create this file to set up your destinations; see Configuration in the README.</p>
            )}
          </div>
        )}
        {destinations.status === 'ready' && <ShareForm destinations={destinations.value} />}
      </div>
    </main>
  );
}
