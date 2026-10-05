/**
 * Failure categories DevShare reports. Interfaces (CLI, desktop) can branch on the code
 * to decide how to present an error without parsing messages.
 */
export type DevShareErrorCode =
  | 'EMPTY_PAYLOAD'
  | 'INVALID_ATTACHMENT'
  | 'FILE_NOT_FOUND'
  | 'FILE_NOT_READABLE'
  | 'NOT_A_FILE'
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_NOT_READABLE'
  | 'INVALID_CONFIG'
  | 'DESTINATION_NOT_FOUND'
  | 'DESTINATION_REQUIRED';

/**
 * An expected, user-actionable failure. Messages must be concise and must never contain
 * secrets such as webhook URLs; low-level details belong in `cause`.
 */
export class DevShareError extends Error {
  override readonly name = 'DevShareError';

  constructor(
    readonly code: DevShareErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
