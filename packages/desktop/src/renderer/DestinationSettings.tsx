import { useEffect, useState, type SubmitEvent } from 'react';

import type {
  DestinationSettingsItem,
  DestinationSettingsView,
  IpcError,
  IpcResult,
  WebhookStatus,
} from '../shared/ipc.js';

type SettingsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: IpcError }
  | { readonly status: 'ready'; readonly value: DestinationSettingsView };

/** What the list is doing: nothing, adding a destination, editing one, or confirming removal. */
type Mode =
  | { readonly kind: 'list' }
  | { readonly kind: 'add' }
  | { readonly kind: 'edit'; readonly name: string }
  | { readonly kind: 'confirm-remove'; readonly name: string };

const STATUS_TEXT: Readonly<Record<WebhookStatus, string>> = {
  saved: 'Webhook saved',
  environment: 'Webhook from an environment variable',
  missing: 'No webhook URL yet',
  'not-applicable': '',
};

/** Lists destinations and lets the user add, change, remove, and choose the default. */
export function DestinationSettings() {
  const [settings, setSettings] = useState<SettingsState>({ status: 'loading' });
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [error, setError] = useState<IpcError | undefined>();

  useEffect(() => {
    let active = true;
    void window.devshare.getDestinationSettings().then((result) => {
      if (active) {
        setSettings(
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

  /** Applies the result of a change; returns whether it succeeded. */
  function apply(result: IpcResult<DestinationSettingsView>): boolean {
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setSettings({ status: 'ready', value: result.value });
    setError(undefined);
    setMode({ kind: 'list' });
    return true;
  }

  if (settings.status === 'loading') {
    return <p className="muted">Loading destinations…</p>;
  }
  if (settings.status === 'error') {
    return (
      <div className="error" role="alert">
        <p>{settings.error.message}</p>
        <p>Fix or remove the file, then open Settings again.</p>
      </div>
    );
  }

  const { destinations, defaultDestination, configPath } = settings.value;
  const isDefault = (name: string) =>
    defaultDestination === name || (defaultDestination === undefined && destinations.length === 1);

  return (
    <section className="field" aria-label="Destinations">
      <div className="field-header">
        <span className="field-label">Destinations</span>
        {mode.kind === 'list' && (
          <button
            type="button"
            onClick={() => {
              setError(undefined);
              setMode({ kind: 'add' });
            }}
          >
            Add destination…
          </button>
        )}
      </div>

      {destinations.length === 0 && mode.kind !== 'add' && (
        <p className="muted">No destinations yet. Add a Discord channel to start sharing.</p>
      )}

      {destinations.length > 0 && (
        <ul className="destinations">
          {destinations.map((destination) =>
            mode.kind === 'edit' && mode.name === destination.name ? (
              <li key={destination.name}>
                <DestinationEditor
                  destination={destination}
                  onSave={async (name, webhookUrl) =>
                    apply(
                      await window.devshare.saveDestination({
                        originalName: destination.name,
                        name,
                        ...(webhookUrl && { webhookUrl }),
                      }),
                    )
                  }
                  onCancel={() => {
                    setError(undefined);
                    setMode({ kind: 'list' });
                  }}
                />
              </li>
            ) : (
              <li key={destination.name}>
                <div className="destination-row">
                  <span className="destination-name">{destination.name}</span>
                  {isDefault(destination.name) && <span className="badge">Default</span>}
                  <span
                    className={destination.webhookStatus === 'missing' ? 'error-text' : 'muted'}
                  >
                    {STATUS_TEXT[destination.webhookStatus]}
                  </span>
                </div>
                {mode.kind === 'confirm-remove' && mode.name === destination.name ? (
                  <div className="buttons">
                    <span>Remove {destination.name}?</span>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        void window.devshare.removeDestination(destination.name).then(apply);
                      }}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode({ kind: 'list' });
                      }}
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  mode.kind === 'list' && (
                    <div className="buttons">
                      <button
                        type="button"
                        onClick={() => {
                          setError(undefined);
                          setMode({ kind: 'edit', name: destination.name });
                        }}
                      >
                        Edit…
                      </button>
                      {!isDefault(destination.name) && (
                        <button
                          type="button"
                          onClick={() => {
                            void window.devshare
                              .setDefaultDestination(destination.name)
                              .then(apply);
                          }}
                        >
                          Make default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setError(undefined);
                          setMode({ kind: 'confirm-remove', name: destination.name });
                        }}
                      >
                        Remove…
                      </button>
                    </div>
                  )
                )}
                {destination.webhookStatus === 'environment' && (
                  <p className="muted">
                    {destination.webhookVariable} is set as an environment variable, so it is used
                    instead of any URL saved here.
                  </p>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {mode.kind === 'add' && (
        <DestinationEditor
          destination={undefined}
          onSave={async (name, webhookUrl) =>
            apply(
              await window.devshare.saveDestination({ name, ...(webhookUrl && { webhookUrl }) }),
            )
          }
          onCancel={() => {
            setError(undefined);
            setMode({ kind: 'list' });
          }}
        />
      )}

      {error && (
        <p className="error-text" role="alert">
          {error.message}
        </p>
      )}

      <p className="muted">
        Saved in {configPath}; webhook URLs go in the .env file in the same folder.
      </p>
    </section>
  );
}

interface DestinationEditorProps {
  /** The destination being changed, or undefined when adding one. */
  readonly destination: DestinationSettingsItem | undefined;
  /** Saves the destination; resolves with whether it succeeded. */
  readonly onSave: (name: string, webhookUrl: string) => Promise<boolean>;
  readonly onCancel: () => void;
}

function DestinationEditor({ destination, onSave, onCancel }: DestinationEditorProps) {
  const [name, setName] = useState(destination?.name ?? '');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const usesWebhook = destination?.webhookStatus !== 'not-applicable';
  const hasWebhook = destination !== undefined && destination.webhookStatus !== 'missing';

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    setSaving(true);
    const saved = await onSave(name, webhookUrl);
    if (!saved) {
      setSaving(false);
    }
  }

  return (
    <form className="destination-editor" onSubmit={(event) => void onSubmit(event)}>
      <label className="field">
        <span className="field-label">Name</span>
        <input
          type="text"
          value={name}
          maxLength={50}
          placeholder="e.g. backend"
          autoFocus
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </label>
      {usesWebhook && (
        <label className="field">
          <span className="field-label">Discord webhook URL</span>
          {/* A password field, so the secret is not shown on screen or offered for autofill. */}
          <input
            type="password"
            value={webhookUrl}
            autoComplete="off"
            spellCheck={false}
            placeholder={
              hasWebhook
                ? 'Leave empty to keep the saved URL'
                : 'https://discord.com/api/webhooks/…'
            }
            onChange={(event) => {
              setWebhookUrl(event.target.value);
            }}
          />
          <span className="muted">
            In Discord: channel settings → Integrations → Webhooks → Copy Webhook URL.
          </span>
        </label>
      )}
      <div className="buttons">
        <button type="submit" className="primary" disabled={saving || name.trim() === ''}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
