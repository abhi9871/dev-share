import { describe, expect, it, vi } from 'vitest';

import {
  hideOnClose,
  showWindow,
  trayMenuTemplate,
  type BackgroundWindow,
} from '../src/main/background.js';

function fakeWindow({ minimized = false } = {}) {
  let closeListener: ((event: { preventDefault(): void }) => void) | undefined;
  const window = {
    on: vi.fn((_event: 'close', listener: (event: { preventDefault(): void }) => void) => {
      closeListener = listener;
    }),
    hide: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    isMinimized: () => minimized,
  } satisfies BackgroundWindow;

  /** Simulates the user closing the window; returns whether the close was prevented. */
  function close(): boolean {
    const event = { preventDefault: vi.fn() };
    closeListener?.(event);
    return event.preventDefault.mock.calls.length > 0;
  }

  return { window, close };
}

describe('hideOnClose', () => {
  it('hides the window instead of closing it', () => {
    const { window, close } = fakeWindow();
    hideOnClose(window, () => undefined);

    expect(close()).toBe(true);
    expect(window.hide).toHaveBeenCalledOnce();
  });

  it('tells the user where the app went only the first time', () => {
    const { window, close } = fakeWindow();
    const onFirstHide = vi.fn();
    hideOnClose(window, onFirstHide);

    close();
    close();

    expect(window.hide).toHaveBeenCalledTimes(2);
    expect(onFirstHide).toHaveBeenCalledOnce();
  });

  it('lets the window close once the app is quitting', () => {
    const { window, close } = fakeWindow();
    const allowClose = hideOnClose(window, () => undefined);

    allowClose();

    expect(close()).toBe(false);
    expect(window.hide).not.toHaveBeenCalled();
  });
});

describe('showWindow', () => {
  it('shows and focuses a hidden window', () => {
    const { window } = fakeWindow();

    showWindow(window);

    expect(window.show).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(window.restore).not.toHaveBeenCalled();
  });

  it('restores a minimized window', () => {
    const { window } = fakeWindow({ minimized: true });

    showWindow(window);

    expect(window.restore).toHaveBeenCalledOnce();
    expect(window.show).toHaveBeenCalledOnce();
  });
});

describe('trayMenuTemplate', () => {
  it('offers Open and Quit, wired to the given actions', () => {
    const actions = { open: vi.fn(), quit: vi.fn() };

    const items = trayMenuTemplate(actions);

    expect(items.map((item) => item.label ?? item.type)).toEqual([
      'Open DevShare',
      'separator',
      'Quit DevShare',
    ]);
    expect(items[0]?.click).toBe(actions.open);
    expect(items[2]?.click).toBe(actions.quit);
  });
});
