import { DevShareError, type Attachment, type SharePayload } from '@devshare/core';
import { describe, expect, it, vi } from 'vitest';

import {
  EXIT_FAILURE,
  EXIT_SUCCESS,
  EXIT_USAGE,
  runCli,
  type CliDependencies,
} from '../src/run.js';

interface Sent {
  readonly payload: SharePayload;
  readonly destination: string | undefined;
}

function fakeAttachment(path: string): Attachment {
  return {
    name: path,
    mediaType: 'text/plain',
    data: new TextEncoder().encode(`contents of ${path}`),
  };
}

/** Runs the CLI against fakes and captures what it sent and printed. */
async function run(
  argv: string[],
  overrides: Partial<CliDependencies> = {},
): Promise<{ exitCode: number; out: string; err: string; sent: Sent[] }> {
  let out = '';
  let err = '';
  const sent: Sent[] = [];
  const exitCode = await runCli(argv, {
    version: '1.2.3',
    writeOut: (text) => (out += text),
    writeError: (text) => (err += text),
    readAttachment: (path) => Promise.resolve(fakeAttachment(path)),
    loadSharingService: () =>
      Promise.resolve({
        share: (payload, destination) => {
          sent.push({ payload, destination });
          return Promise.resolve({ destination: destination ?? 'General' });
        },
      }),
    ...overrides,
  });
  return { exitCode, out, err, sent };
}

describe('devshare CLI', () => {
  it('shares a text message to the default destination', async () => {
    const { exitCode, out, err, sent } = await run(['Please check this authentication issue']);

    expect(exitCode).toBe(EXIT_SUCCESS);
    expect(sent).toEqual([
      {
        payload: { text: 'Please check this authentication issue', attachments: [] },
        destination: undefined,
      },
    ]);
    expect(out).toBe('Shared message to General.\n');
    expect(err).toBe('');
  });

  it('shares a file on its own', async () => {
    const { exitCode, out, sent } = await run(['--file', 'publicClient.ts']);

    expect(exitCode).toBe(EXIT_SUCCESS);
    expect(sent[0]?.payload).toEqual({ attachments: [fakeAttachment('publicClient.ts')] });
    expect(out).toBe('Shared 1 file to General.\n');
  });

  it('shares a message with multiple files in one share', async () => {
    const { out, sent } = await run([
      '--file',
      'auth.ts',
      '--file',
      'publicClient.ts',
      'Please review these',
    ]);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.payload).toEqual({
      text: 'Please review these',
      attachments: [fakeAttachment('auth.ts'), fakeAttachment('publicClient.ts')],
    });
    expect(out).toBe('Shared message and 2 files to General.\n');
  });

  it('shares to the selected destination', async () => {
    const { out, sent } = await run(['--destination', 'Backend', 'Please test this']);

    expect(sent[0]?.destination).toBe('Backend');
    expect(out).toBe('Shared message to Backend.\n');
  });

  it('prints help and version without sharing', async () => {
    const help = await run(['--help']);
    const version = await run(['--version']);

    expect(help.out).toContain('Usage: devshare');
    expect(version.out).toBe('1.2.3\n');
    expect([...help.sent, ...version.sent]).toEqual([]);
  });

  it('rejects invalid arguments with a usage hint and exit code 2', async () => {
    const { exitCode, err, sent } = await run(['--bogus']);

    expect(exitCode).toBe(EXIT_USAGE);
    expect(err).toContain('devshare --help');
    expect(sent).toEqual([]);
  });

  it('reports an empty share without loading the config', async () => {
    const loadSharingService = vi.fn<CliDependencies['loadSharingService']>();

    const { exitCode, err } = await run([], { loadSharingService });

    expect(exitCode).toBe(EXIT_FAILURE);
    expect(err).toBe('devshare: Nothing to share: provide text or at least one file.\n');
    expect(loadSharingService).not.toHaveBeenCalled();
  });

  it('reports an unreadable file without sharing anything', async () => {
    const { exitCode, err, sent } = await run(['--file', 'missing.ts', 'hello'], {
      readAttachment: (path) =>
        Promise.reject(new DevShareError('FILE_NOT_FOUND', `File not found: "${path}".`)),
    });

    expect(exitCode).toBe(EXIT_FAILURE);
    expect(err).toBe('devshare: File not found: "missing.ts".\n');
    expect(sent).toEqual([]);
  });

  it('points to the configuration docs when the config file is missing', async () => {
    const { exitCode, err } = await run(['hello'], {
      loadSharingService: () =>
        Promise.reject(new DevShareError('CONFIG_NOT_FOUND', 'Config file not found: "x".')),
    });

    expect(exitCode).toBe(EXIT_FAILURE);
    expect(err).toContain('Config file not found');
    expect(err).toContain('#configuration');
  });

  it('reports sharing failures', async () => {
    const { exitCode, err } = await run(['hello'], {
      loadSharingService: () =>
        Promise.resolve({
          share: () =>
            Promise.reject(new DevShareError('DESTINATION_NOT_FOUND', 'Unknown destination "x".')),
        }),
    });

    expect(exitCode).toBe(EXIT_FAILURE);
    expect(err).toBe('devshare: Unknown destination "x".\n');
  });
});
