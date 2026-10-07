/**
 * A user-actionable failure specific to the desktop app, reported to the renderer with its
 * code. Failures from the core library use `DevShareError` instead.
 */
export class DesktopError extends Error {
  override readonly name = 'DesktopError';

  constructor(
    readonly code: 'INVALID_REQUEST' | 'SHORTCUT_UNAVAILABLE',
    message: string,
  ) {
    super(message);
  }
}

/** Renderer input that does not match the IPC contract. */
export function invalidRequest(message = 'Invalid request.'): DesktopError {
  return new DesktopError('INVALID_REQUEST', message);
}
