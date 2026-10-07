/**
 * Global shortcuts, written as Electron accelerators such as `CommandOrControl+Shift+A`.
 * Shared so the settings screen and the main process apply the same rules.
 */

export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+A';

/** Modifiers in the order they appear in an accelerator. */
const MODIFIERS: readonly string[] = ['CommandOrControl', 'Alt', 'Shift'];
/** Letters, digits, function keys, and Space. */
const KEY = /^(?:[A-Z]|[0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space)$/;

/** The parts of a keyboard event needed to turn a key press into a shortcut. */
export interface KeyPress {
  /** Physical key, e.g. `KeyA`; used so shortcuts do not depend on the keyboard layout. */
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
}

/**
 * Whether DevShare accepts `accelerator` as its shortcut: Ctrl and/or Alt, optionally Shift,
 * plus a letter, digit, function key, or Space. Requiring Ctrl or Alt keeps a global shortcut
 * from swallowing ordinary typing in other apps.
 */
export function isValidShortcut(accelerator: string): boolean {
  const modifiers = accelerator.split('+');
  const key = modifiers.pop();
  if (key === undefined || !KEY.test(key)) {
    return false;
  }
  let previous = -1;
  for (const modifier of modifiers) {
    const position = MODIFIERS.indexOf(modifier);
    if (position <= previous) {
      // Unknown, repeated, or out of order.
      return false;
    }
    previous = position;
  }
  return modifiers.includes('CommandOrControl') || modifiers.includes('Alt');
}

/**
 * The accelerator for a key press, or undefined while it cannot be one yet (for example,
 * only modifiers are held). The result may still fail `isValidShortcut`, e.g. `Shift+A`.
 */
export function shortcutFromKeyPress(press: KeyPress): string | undefined {
  const key = keyName(press.code);
  // The Windows key is reserved for system shortcuts.
  if (key === undefined || press.metaKey) {
    return undefined;
  }
  const parts: string[] = [];
  if (press.ctrlKey) {
    parts.push('CommandOrControl');
  }
  if (press.altKey) {
    parts.push('Alt');
  }
  if (press.shiftKey) {
    parts.push('Shift');
  }
  parts.push(key);
  return parts.join('+');
}

/** How a shortcut is shown on Windows, e.g. `Ctrl+Shift+A`. */
export function shortcutLabel(accelerator: string): string {
  return accelerator.replace('CommandOrControl', 'Ctrl');
}

function keyName(code: string): string | undefined {
  const name = /^(?:Key|Digit)(.)$/.exec(code)?.[1] ?? code;
  return KEY.test(name) ? name : undefined;
}
