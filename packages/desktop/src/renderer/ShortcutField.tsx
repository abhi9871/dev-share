import { useState, type KeyboardEvent } from 'react';

import {
  DEFAULT_SHORTCUT,
  isValidShortcut,
  shortcutFromKeyPress,
  shortcutLabel,
} from '../shared/shortcuts.js';

interface ShortcutFieldProps {
  readonly shortcut: string;
  /** False if the shortcut could not be registered. */
  readonly active: boolean;
  readonly onChange: (shortcut: string) => void;
}

/** Shows the global shortcut and lets the user record a new one by pressing it. */
export function ShortcutField({ shortcut, active, onChange }: ShortcutFieldProps) {
  const [recording, setRecording] = useState(false);
  const [hint, setHint] = useState<string | undefined>();

  function stopRecording() {
    setRecording(false);
    setHint(undefined);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!recording) {
      return;
    }
    event.preventDefault();
    if (event.key === 'Escape') {
      stopRecording();
      return;
    }
    const pressed = shortcutFromKeyPress(event);
    if (pressed === undefined) {
      // Only modifiers so far; wait for the key.
      return;
    }
    if (!isValidShortcut(pressed)) {
      setHint(
        `${shortcutLabel(pressed)} can't be used. Include Ctrl or Alt, plus a letter, number, or F-key.`,
      );
      return;
    }
    stopRecording();
    onChange(pressed);
  }

  return (
    <div className="field">
      <span className="field-label">Shortcut</span>
      <div className="shortcut-row">
        <kbd>{shortcutLabel(shortcut)}</kbd>
        <button
          type="button"
          className={recording ? 'recording' : undefined}
          onClick={() => {
            setRecording(true);
          }}
          onKeyDown={onKeyDown}
          onBlur={stopRecording}
        >
          {recording ? 'Press the new shortcut… (Esc to cancel)' : 'Change…'}
        </button>
        {shortcut !== DEFAULT_SHORTCUT && !recording && (
          <button
            type="button"
            onClick={() => {
              onChange(DEFAULT_SHORTCUT);
            }}
          >
            Reset to {shortcutLabel(DEFAULT_SHORTCUT)}
          </button>
        )}
      </div>
      {!active && (
        <p className="error-text">
          This shortcut is not working: another app already uses it. Choose a different one.
        </p>
      )}
      {hint && <p className="muted">{hint}</p>}
      <p className="muted">Brings up DevShare from any app.</p>
    </div>
  );
}
