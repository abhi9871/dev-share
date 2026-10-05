/** Returns the Node.js system error code (e.g. `ENOENT`) of an error, if it has one. */
export function systemErrorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}
