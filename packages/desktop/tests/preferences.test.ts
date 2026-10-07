import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PREFERENCES, PreferencesFile, type Preferences } from '../src/main/preferences.js';
import {
  PreferencesService,
  type PreferencesServiceDependencies,
} from '../src/main/preferences-service.js';

describe('PreferencesFile', () => {
  let dir: string;
  let file: PreferencesFile;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devshare-preferences-'));
    file = new PreferencesFile(join(dir, 'nested', 'desktop.json'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('uses defaults when there is no file yet', async () => {
    await expect(file.load()).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  it('saves preferences and loads them back, creating the folder if needed', async () => {
    const preferences = { shortcut: 'CommandOrControl+Alt+S', loadClipboardOnOpen: false };

    await file.save(preferences);

    await expect(file.load()).resolves.toEqual(preferences);
    expect(JSON.parse(await readFile(file.path, 'utf8'))).toEqual(preferences);
  });

  it('uses defaults for a file that is not valid JSON', async () => {
    await file.save(DEFAULT_PREFERENCES);
    await writeFile(file.path, '{ not json');

    await expect(file.load()).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  it('replaces only the invalid values with defaults', async () => {
    await file.save(DEFAULT_PREFERENCES);
    await writeFile(file.path, JSON.stringify({ shortcut: 'A', loadClipboardOnOpen: false }));

    await expect(file.load()).resolves.toEqual({
      shortcut: DEFAULT_PREFERENCES.shortcut,
      loadClipboardOnOpen: false,
    });
  });
});

/** A preferences service with fakes for the file, the shortcut registry, and Windows. */
async function startService({
  saved = DEFAULT_PREFERENCES,
  unavailable = [] as string[],
  loginEnabled = false,
} = {}) {
  const registered = new Set<string>();
  let loginItem = loginEnabled;
  const onShortcut = vi.fn();
  const deps = {
    file: { load: vi.fn(() => Promise.resolve(saved)), save: vi.fn(() => Promise.resolve()) },
    shortcuts: {
      register: vi.fn((accelerator: string) => {
        if (unavailable.includes(accelerator) || registered.has(accelerator)) {
          return false;
        }
        registered.add(accelerator);
        return true;
      }),
      unregister: vi.fn((accelerator: string) => {
        registered.delete(accelerator);
      }),
    },
    loginItem: {
      isEnabled: () => loginItem,
      setEnabled: vi.fn((enabled: boolean) => {
        loginItem = enabled;
      }),
    },
    onShortcut,
  } satisfies PreferencesServiceDependencies;
  const service = await PreferencesService.start(deps);
  return { service, deps, registered };
}

const INVALID_REQUEST = { code: 'INVALID_REQUEST' };

describe('PreferencesService', () => {
  it('starts with the saved preferences and registers the saved shortcut', async () => {
    const saved: Preferences = { shortcut: 'Alt+Shift+D', loadClipboardOnOpen: false };
    const { service, deps, registered } = await startService({ saved, loginEnabled: true });

    expect(service.view()).toEqual({
      shortcut: 'Alt+Shift+D',
      shortcutActive: true,
      loadClipboardOnOpen: false,
      startAtLogin: true,
    });
    expect([...registered]).toEqual(['Alt+Shift+D']);
    expect(deps.shortcuts.register).toHaveBeenCalledWith('Alt+Shift+D', deps.onShortcut);
  });

  it('reports a saved shortcut that another app already uses as inactive', async () => {
    const { service } = await startService({ unavailable: [DEFAULT_PREFERENCES.shortcut] });

    expect(service.view().shortcutActive).toBe(false);
  });

  it('switches to a new shortcut and releases the old one', async () => {
    const { service, deps, registered } = await startService();

    const view = await service.update({ shortcut: 'CommandOrControl+Alt+S' });

    expect(view).toMatchObject({ shortcut: 'CommandOrControl+Alt+S', shortcutActive: true });
    expect([...registered]).toEqual(['CommandOrControl+Alt+S']);
    expect(deps.file.save).toHaveBeenCalledWith({
      shortcut: 'CommandOrControl+Alt+S',
      loadClipboardOnOpen: true,
    });
  });

  it('keeps the current shortcut and saves nothing when the new one is unavailable', async () => {
    const { service, deps, registered } = await startService({
      unavailable: ['CommandOrControl+Alt+S'],
    });

    await expect(service.update({ shortcut: 'CommandOrControl+Alt+S' })).rejects.toMatchObject({
      code: 'SHORTCUT_UNAVAILABLE',
      message: 'Ctrl+Alt+S is already used by another app. Choose a different shortcut.',
    });
    expect(service.view()).toMatchObject({
      shortcut: DEFAULT_PREFERENCES.shortcut,
      shortcutActive: true,
    });
    expect([...registered]).toEqual([DEFAULT_PREFERENCES.shortcut]);
    expect(deps.file.save).not.toHaveBeenCalled();
  });

  it('does nothing to the registration when the shortcut is unchanged', async () => {
    const { service, deps } = await startService();
    deps.shortcuts.register.mockClear();

    await service.update({ shortcut: DEFAULT_PREFERENCES.shortcut });

    expect(deps.shortcuts.register).not.toHaveBeenCalled();
    expect(deps.shortcuts.unregister).not.toHaveBeenCalled();
  });

  it('retries an inactive shortcut when it is chosen again', async () => {
    const unavailable = [DEFAULT_PREFERENCES.shortcut];
    const { service } = await startService({ unavailable });
    unavailable.length = 0; // The other app has released it.

    const view = await service.update({ shortcut: DEFAULT_PREFERENCES.shortcut });

    expect(view.shortcutActive).toBe(true);
  });

  it('turns start at login on and off through Windows, not the preferences file', async () => {
    const { service, deps } = await startService();

    await expect(service.update({ startAtLogin: true })).resolves.toMatchObject({
      startAtLogin: true,
    });
    await expect(service.update({ startAtLogin: false })).resolves.toMatchObject({
      startAtLogin: false,
    });
    expect(deps.loginItem.setEnabled.mock.calls).toEqual([[true], [false]]);
    expect(deps.file.save).toHaveBeenLastCalledWith(DEFAULT_PREFERENCES);
  });

  it('saves the clipboard preference', async () => {
    const { service, deps } = await startService();

    await service.update({ loadClipboardOnOpen: false });

    expect(service.view().loadClipboardOnOpen).toBe(false);
    expect(deps.file.save).toHaveBeenCalledWith({
      shortcut: DEFAULT_PREFERENCES.shortcut,
      loadClipboardOnOpen: false,
    });
  });

  it.each([
    ['no update', undefined],
    ['a list', []],
    ['an unknown preference', { theme: 'dark' }],
    ['an invalid shortcut', { shortcut: 'Shift+A' }],
    ['a non-string shortcut', { shortcut: 42 }],
    ['a non-boolean clipboard preference', { loadClipboardOnOpen: 'yes' }],
    ['a non-boolean login preference', { startAtLogin: 1 }],
  ])('rejects %s without changing anything', async (_case, input) => {
    const { service, deps } = await startService();

    await expect(service.update(input)).rejects.toMatchObject(INVALID_REQUEST);
    expect(deps.loginItem.setEnabled).not.toHaveBeenCalled();
    expect(deps.file.save).not.toHaveBeenCalled();
  });
});
