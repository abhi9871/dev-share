import { useState } from 'react';

import { SettingsView } from './SettingsView.js';
import { ShareForm } from './ShareForm.js';
import { useDestinations } from './useDestinations.js';

export function App() {
  const [showSettings, setShowSettings] = useState(false);
  // Bumped when leaving settings, where destinations may have changed.
  const [destinationsVersion, setDestinationsVersion] = useState(0);
  const destinations = useDestinations(destinationsVersion);

  function toggleSettings() {
    if (showSettings) {
      setDestinationsVersion((current) => current + 1);
    }
    setShowSettings(!showSettings);
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>{showSettings ? 'Settings' : 'DevShare'}</h1>
        <button type="button" onClick={toggleSettings}>
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
              <p>Open Settings and add a destination to get started.</p>
            )}
          </div>
        )}
        {destinations.status === 'ready' && <ShareForm destinations={destinations.value} />}
      </div>
    </main>
  );
}
