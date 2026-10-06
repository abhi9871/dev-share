import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

import { DevShareError } from './errors.js';
import { systemErrorCode } from './node-errors.js';
import { stripByteOrderMark } from './text.js';
import type { Environment } from './transport.js';

/**
 * Reads `KEY=value` pairs from an optional `.env` file. A missing file is not an error:
 * secrets can also come from real environment variables.
 */
export async function readEnvFile(path: string): Promise<Environment> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (systemErrorCode(error) === 'ENOENT') {
      return {};
    }
    throw new DevShareError('ENV_FILE_NOT_READABLE', `Could not read "${path}".`, {
      cause: error,
    });
  }
  return parseEnv(stripByteOrderMark(text));
}
