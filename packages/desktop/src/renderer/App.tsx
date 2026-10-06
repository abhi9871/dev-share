import { useState } from 'react';

import { DestinationPicker } from './DestinationPicker.js';
import { useDestinations } from './useDestinations.js';

export function App() {
  const destinations = useDestinations();
  const [chosen, setChosen] = useState<string | undefined>();

  return (
    <main className="app">
      <h1>DevShare</h1>
      {destinations.status === 'loading' && <p className="muted">Loading destinations…</p>}
      {destinations.status === 'error' && (
        <div className="error" role="alert">
          <p>{destinations.error.message}</p>
          {destinations.error.code === 'CONFIG_NOT_FOUND' && (
            <p>Create this file to set up your destinations; see Configuration in the README.</p>
          )}
        </div>
      )}
      {destinations.status === 'ready' && (
        <DestinationPicker
          destinations={destinations.value.destinations}
          value={chosen ?? destinations.value.defaultDestination ?? ''}
          onChange={setChosen}
        />
      )}
    </main>
  );
}
