import type { PreferencesUpdate, PreferencesView } from '../shared/ipc.js';
import { isValidShortcut, shortcutLabel } from '../shared/shortcuts.js';
import { DesktopError, invalidRequest } from './errors.js';
import type { Preferences } from './preferences.js';

export interface PreferencesServiceDependencies {
  readonly file: {
    load(): Promise<Preferences>;
    save(preferences: Preferences): Promise<void>;
  };
  readonly shortcuts: {
    /** Returns false if the shortcut is unavailable, e.g. used by another app. */
    register(accelerator: string, onPress: () => void): boolean;
    unregister(accelerator: string): void;
  };
  readonly loginItem: {
    isEnabled(): boolean;
    setEnabled(enabled: boolean): void;
  };
  /** Runs when the user presses the global shortcut. */
  readonly onShortcut: () => void;
}

const UPDATE_KEYS: ReadonlySet<string> = new Set([
  'shortcut',
  'loadClipboardOnOpen',
  'startAtLogin',
]);

/** Owns the user's preferences and keeps the global shortcut and login item in line with them. */
export class PreferencesService {
  readonly #deps: PreferencesServiceDependencies;
  #preferences: Preferences;
  #shortcutActive: boolean;

  private constructor(
    deps: PreferencesServiceDependencies,
    preferences: Preferences,
    shortcutActive: boolean,
  ) {
    this.#deps = deps;
    this.#preferences = preferences;
    this.#shortcutActive = shortcutActive;
  }

  /** Loads saved preferences and registers the shortcut. */
  static async start(deps: PreferencesServiceDependencies): Promise<PreferencesService> {
    const preferences = await deps.file.load();
    const active = deps.shortcuts.register(preferences.shortcut, deps.onShortcut);
    return new PreferencesService(deps, preferences, active);
  }

  view(): PreferencesView {
    return {
      ...this.#preferences,
      shortcutActive: this.#shortcutActive,
      startAtLogin: this.#deps.loginItem.isEnabled(),
    };
  }

  /**
   * Validates and applies an update from the renderer. A new shortcut is registered before
   * the old one is released, so a shortcut that turns out to be unavailable changes nothing.
   */
  async update(input: unknown): Promise<PreferencesView> {
    const update = parseUpdate(input);

    if (update.shortcut !== undefined) {
      this.#changeShortcut(update.shortcut);
    }
    if (update.startAtLogin !== undefined) {
      this.#deps.loginItem.setEnabled(update.startAtLogin);
    }

    const { shortcut, loadClipboardOnOpen } = this.#preferences;
    this.#preferences = {
      shortcut: update.shortcut ?? shortcut,
      loadClipboardOnOpen: update.loadClipboardOnOpen ?? loadClipboardOnOpen,
    };
    await this.#deps.file.save(this.#preferences);
    return this.view();
  }

  #changeShortcut(shortcut: string): void {
    const current = this.#preferences.shortcut;
    if (shortcut === current && this.#shortcutActive) {
      return;
    }
    if (!this.#deps.shortcuts.register(shortcut, this.#deps.onShortcut)) {
      throw new DesktopError(
        'SHORTCUT_UNAVAILABLE',
        `${shortcutLabel(shortcut)} is already used by another app. Choose a different shortcut.`,
      );
    }
    if (shortcut !== current && this.#shortcutActive) {
      this.#deps.shortcuts.unregister(current);
    }
    this.#shortcutActive = true;
  }
}

function parseUpdate(input: unknown): PreferencesUpdate {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw invalidRequest();
  }
  const value = input as Record<string, unknown>;
  const { shortcut, loadClipboardOnOpen, startAtLogin } = value;
  if (
    Object.keys(value).some((key) => !UPDATE_KEYS.has(key)) ||
    (shortcut !== undefined && (typeof shortcut !== 'string' || !isValidShortcut(shortcut))) ||
    (loadClipboardOnOpen !== undefined && typeof loadClipboardOnOpen !== 'boolean') ||
    (startAtLogin !== undefined && typeof startAtLogin !== 'boolean')
  ) {
    throw invalidRequest();
  }
  return {
    ...(shortcut !== undefined && { shortcut }),
    ...(loadClipboardOnOpen !== undefined && { loadClipboardOnOpen }),
    ...(startAtLogin !== undefined && { startAtLogin }),
  };
}
