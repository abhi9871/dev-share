import { globalShortcut } from 'electron';

/** Brings up DevShare from any app. */
export const SHORTCUT = 'CommandOrControl+Shift+A';
/** How the shortcut is shown to Windows users. */
export const SHORTCUT_LABEL = 'Ctrl+Shift+A';

/**
 * Registers the global shortcut. Returns false if it could not be registered, which happens
 * when another app already uses it.
 */
export function registerShortcut(onPress: () => void): boolean {
  return globalShortcut.register(SHORTCUT, onPress);
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}
