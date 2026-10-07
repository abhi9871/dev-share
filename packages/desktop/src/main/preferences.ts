import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { DEFAULT_SHORTCUT, isValidShortcut } from '../shared/shortcuts.js';

/** Desktop-only preferences. Start at login is not stored here: Windows keeps that setting. */
export interface Preferences {
  readonly shortcut: string;
  readonly loadClipboardOnOpen: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  shortcut: DEFAULT_SHORTCUT,
  loadClipboardOnOpen: true,
};

/**
 * Preferences stored as JSON, next to `config.json`. The file belongs to the desktop app, so
 * a missing, unreadable, or hand-broken file falls back to defaults instead of stopping the
 * app from starting.
 */
export class PreferencesFile {
  constructor(readonly path: string) {}

  async load(): Promise<Preferences> {
    let json: unknown;
    try {
      json = JSON.parse(await readFile(this.path, 'utf8'));
    } catch {
      return DEFAULT_PREFERENCES;
    }
    const value =
      typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
    return {
      shortcut:
        typeof value.shortcut === 'string' && isValidShortcut(value.shortcut)
          ? value.shortcut
          : DEFAULT_PREFERENCES.shortcut,
      loadClipboardOnOpen:
        typeof value.loadClipboardOnOpen === 'boolean'
          ? value.loadClipboardOnOpen
          : DEFAULT_PREFERENCES.loadClipboardOnOpen,
    };
  }

  /** Writes via a temporary file, so an interrupted save never leaves a half-written file. */
  async save(preferences: Preferences): Promise<void> {
    const temporaryPath = `${this.path}.tmp`;
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(preferences, undefined, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.path);
  }
}
