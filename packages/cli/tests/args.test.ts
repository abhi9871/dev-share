import { describe, expect, it } from 'vitest';

import { parseCliArgs, UsageError } from '../src/args.js';

describe('parseCliArgs', () => {
  it('parses a quoted message', () => {
    expect(parseCliArgs(['Please check this authentication issue'])).toEqual({
      kind: 'share',
      text: 'Please check this authentication issue',
      files: [],
      destination: undefined,
    });
  });

  it('joins unquoted words into one message', () => {
    expect(parseCliArgs(['Please', 'check', 'this'])).toMatchObject({ text: 'Please check this' });
  });

  it('parses a file without a message', () => {
    expect(parseCliArgs(['--file', 'publicClient.ts'])).toEqual({
      kind: 'share',
      text: undefined,
      files: ['publicClient.ts'],
      destination: undefined,
    });
  });

  it('parses multiple files with short and long flags', () => {
    expect(
      parseCliArgs(['--file', 'auth.ts', '-f', 'publicClient.ts', 'Please review these']),
    ).toMatchObject({
      files: ['auth.ts', 'publicClient.ts'],
      text: 'Please review these',
    });
  });

  it.each([
    [['--destination', 'backend', 'Please test this']],
    [['-d', 'backend', 'Please test this']],
    [['--destination=backend', 'Please test this']],
  ])('parses the destination from %j', (argv) => {
    expect(parseCliArgs(argv)).toMatchObject({ destination: 'backend', text: 'Please test this' });
  });

  it.each([
    [['--help'], 'help'],
    [['-h', 'ignored message'], 'help'],
    [['--version'], 'version'],
    [['-v'], 'version'],
  ])('parses %j as %s', (argv, kind) => {
    expect(parseCliArgs(argv)).toEqual({ kind });
  });

  it.each([
    ['an unknown option', ['--unknown']],
    ['--file without a path', ['--file']],
    ['an empty --file path', ['--file', '']],
    ['--destination without a name', ['--destination']],
    ['an empty --destination', ['--destination', ' ']],
  ])('rejects %s', (_label, argv) => {
    expect(() => parseCliArgs(argv)).toThrow(UsageError);
  });
});
