import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SHORTCUT,
  isValidShortcut,
  shortcutFromKeyPress,
  shortcutLabel,
  type KeyPress,
} from '../src/shared/shortcuts.js';

function press(code: string, modifiers: Partial<Omit<KeyPress, 'code'>> = {}): KeyPress {
  return { code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...modifiers };
}

describe('isValidShortcut', () => {
  it.each([
    DEFAULT_SHORTCUT,
    'CommandOrControl+Alt+S',
    'Alt+Shift+1',
    'CommandOrControl+F12',
    'CommandOrControl+Space',
  ])('accepts %s', (accelerator) => {
    expect(isValidShortcut(accelerator)).toBe(true);
  });

  it.each([
    ['a key on its own', 'A'],
    ['Shift alone, which would swallow capital letters', 'Shift+A'],
    ['only modifiers', 'CommandOrControl+Shift'],
    ['an unsupported key', 'CommandOrControl+Escape'],
    ['a lowercase key', 'CommandOrControl+a'],
    ['an unknown modifier', 'Super+A'],
    ['a repeated modifier', 'CommandOrControl+CommandOrControl+A'],
    ['modifiers out of order', 'Shift+CommandOrControl+A'],
    ['F25, which does not exist', 'CommandOrControl+F25'],
    ['an empty string', ''],
  ])('rejects %s', (_case, accelerator) => {
    expect(isValidShortcut(accelerator)).toBe(false);
  });
});

describe('shortcutFromKeyPress', () => {
  it('builds accelerators with modifiers in canonical order', () => {
    expect(shortcutFromKeyPress(press('KeyA', { shiftKey: true, ctrlKey: true }))).toBe(
      'CommandOrControl+Shift+A',
    );
    expect(shortcutFromKeyPress(press('Digit5', { altKey: true }))).toBe('Alt+5');
    expect(shortcutFromKeyPress(press('F9', { ctrlKey: true, altKey: true }))).toBe(
      'CommandOrControl+Alt+F9',
    );
    expect(shortcutFromKeyPress(press('Space', { ctrlKey: true }))).toBe('CommandOrControl+Space');
  });

  it('waits while only modifiers are held', () => {
    expect(shortcutFromKeyPress(press('ControlLeft', { ctrlKey: true }))).toBeUndefined();
    expect(shortcutFromKeyPress(press('ShiftRight', { shiftKey: true }))).toBeUndefined();
  });

  it('ignores keys that cannot be part of a shortcut', () => {
    expect(shortcutFromKeyPress(press('Escape', { ctrlKey: true }))).toBeUndefined();
    expect(shortcutFromKeyPress(press('Semicolon', { ctrlKey: true }))).toBeUndefined();
  });

  it('refuses the Windows key, which is reserved for system shortcuts', () => {
    expect(shortcutFromKeyPress(press('KeyA', { metaKey: true }))).toBeUndefined();
  });

  it('may return shortcuts that are not valid on their own, for the caller to explain', () => {
    const shortcut = shortcutFromKeyPress(press('KeyA', { shiftKey: true }));

    expect(shortcut).toBe('Shift+A');
    expect(isValidShortcut(shortcut ?? '')).toBe(false);
  });
});

describe('shortcutLabel', () => {
  it('shows CommandOrControl as Ctrl', () => {
    expect(shortcutLabel('CommandOrControl+Alt+S')).toBe('Ctrl+Alt+S');
    expect(shortcutLabel('Alt+Shift+1')).toBe('Alt+Shift+1');
  });
});
