import { useEffect, useState } from 'react';

import type { IpcError, PreferencesUpdate, PreferencesView } from '../shared/ipc.js';
import { ShortcutField } from './ShortcutField.js';

type PreferencesState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: IpcError }
  | { readonly status: 'ready'; readonly value: PreferencesView };

export function SettingsView() {
  const [preferences, setPreferences] = useState<PreferencesState>({ status: 'loading' });
  const [saveError, setSaveError] = useState<IpcError | undefined>();

  useEffect(() => {
    let active = true;
    void window.devshare.getPreferences().then((result) => {
      if (active) {
        setPreferences(
          result.ok
            ? { status: 'ready', value: result.value }
            : { status: 'error', error: result.error },
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function update(change: PreferencesUpdate) {
    const result = await window.devshare.updatePreferences(change);
    if (result.ok) {
      setPreferences({ status: 'ready', value: result.value });
      setSaveError(undefined);
    } else {
      setSaveError(result.error);
    }
  }

  if (preferences.status === 'loading') {
    return <p className="muted">Loading settings…</p>;
  }
  if (preferences.status === 'error') {
    return (
      <p className="error-text" role="alert">
        {preferences.error.message}
      </p>
    );
  }

  const { value } = preferences;
  return (
    <section className="settings" aria-label="Settings">
      <ShortcutField
        shortcut={value.shortcut}
        active={value.shortcutActive}
        onChange={(shortcut) => {
          void update({ shortcut });
        }}
      />

      <label className="checkbox">
        <input
          type="checkbox"
          checked={value.loadClipboardOnOpen}
          onChange={(event) => {
            void update({ loadClipboardOnOpen: event.target.checked });
          }}
        />
        <span>
          Load what I copied when DevShare opens
          <span className="muted">
            Only when nothing is waiting to be shared. Nothing is sent until you press Share.
          </span>
        </span>
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={value.startAtLogin}
          onChange={(event) => {
            void update({ startAtLogin: event.target.checked });
          }}
        />
        <span>
          Start DevShare when I sign in to Windows
          <span className="muted">It starts in the tray, ready for the shortcut.</span>
        </span>
      </label>

      {saveError && (
        <p className="error-text" role="alert">
          {saveError.message}
        </p>
      )}

      <p className="muted">
        Destinations are set up in config.json; see Configuration in the README.
      </p>
    </section>
  );
}
