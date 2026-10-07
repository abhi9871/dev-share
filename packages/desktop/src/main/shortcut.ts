import { globalShortcut } from 'electron';

import type { PreferencesServiceDependencies } from './preferences-service.js';

/** Global shortcuts through Electron, which fails to register ones another app already uses. */
export const electronShortcuts: PreferencesServiceDependencies['shortcuts'] = {
  register: (accelerator, onPress) => globalShortcut.register(accelerator, onPress),
  unregister: (accelerator) => {
    globalShortcut.unregister(accelerator);
  },
};

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}
