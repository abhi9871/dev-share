import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

import { DevShareError } from './errors.js';
import { writeFileAtomic } from './files.js';
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

/** Characters that would need quoting or escaping in a `.env` value; secrets never need them. */
const UNSAFE_VALUE = /[\s"'`#\\]/;
const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Sets (string) or removes (undefined) variables in a `.env` file, creating it if needed.
 * Every other line, including comments and other variables, is kept as it is.
 */
export async function updateEnvFile(
  path: string,
  changes: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  for (const [name, value] of Object.entries(changes)) {
    if (!VARIABLE_NAME.test(name)) {
      throw new DevShareError('INVALID_CONFIG', `"${name}" is not a valid variable name.`);
    }
    if (value !== undefined && (value === '' || UNSAFE_VALUE.test(value))) {
      // The value is a secret, so it is deliberately not part of the message.
      throw new DevShareError('INVALID_CONFIG', `The value for ${name} cannot be saved.`);
    }
  }

  let text: string;
  try {
    text = stripByteOrderMark(await readFile(path, 'utf8'));
  } catch (error) {
    if (systemErrorCode(error) !== 'ENOENT') {
      throw new DevShareError('ENV_FILE_NOT_READABLE', `Could not read "${path}".`, {
        cause: error,
      });
    }
    text = '';
  }

  const pending = new Map(Object.entries(changes));
  const lines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const name = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
    if (name === undefined || !(name in changes)) {
      lines.push(line);
      continue;
    }
    // Write the new value in place of the first definition and drop any repeats.
    if (pending.has(name)) {
      const value = pending.get(name);
      pending.delete(name);
      if (value !== undefined) {
        lines.push(`${name}=${value}`);
      }
    }
  }
  while (lines.length > 0 && lines.at(-1) === '') {
    lines.pop();
  }
  for (const [name, value] of pending) {
    if (value !== undefined) {
      lines.push(`${name}=${value}`);
    }
  }
  await writeFileAtomic(path, lines.length > 0 ? `${lines.join('\n')}\n` : '');
}
