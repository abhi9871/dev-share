import { ShareForm } from './ShareForm.js';
import { useDestinations } from './useDestinations.js';

export function App() {
  const destinations = useDestinations();

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
      {destinations.status === 'ready' && <ShareForm destinations={destinations.value} />}
    </main>
  );
}
