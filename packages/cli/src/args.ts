import { parseArgs } from 'node:util';

export const USAGE = `Usage: devshare [options] [message...]

Share a message and/or files to a configured destination.

Options:
  -f, --file <path>          Attach a file (repeat for multiple files)
  -d, --destination <name>   Destination to share to (default: from your config)
      --stdin                Read the message from standard input instead
  -l, --list                 List the configured destinations
  -h, --help                 Show this help
  -v, --version              Show the version

Examples:
  devshare "Please check this authentication issue"
  devshare --file screenshot.png "Please check this screenshot"
  devshare --file auth.ts --file publicClient.ts "Please review these"
  devshare --destination backend "Please test this"
  npm test 2>&1 | devshare --destination bugs --stdin`;

export type CliCommand =
  | { readonly kind: 'help' }
  | { readonly kind: 'version' }
  | { readonly kind: 'list' }
  | {
      readonly kind: 'share';
      readonly text: string | undefined;
      /** Read the message from standard input; `text` is then undefined. */
      readonly stdin: boolean;
      readonly files: readonly string[];
      readonly destination: string | undefined;
    };

/** Invalid command-line usage, reported with a hint to run `--help`. */
export class UsageError extends Error {
  override readonly name = 'UsageError';
}

export function parseCliArgs(argv: readonly string[]): CliCommand {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        file: { type: 'string', short: 'f', multiple: true },
        destination: { type: 'string', short: 'd' },
        stdin: { type: 'boolean' },
        list: { type: 'boolean', short: 'l' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error), { cause: error });
  }

  const { values, positionals } = parsed;
  if (values.help) {
    return { kind: 'help' };
  }
  if (values.version) {
    return { kind: 'version' };
  }

  const files = values.file ?? [];
  if (values.list) {
    if (
      files.length > 0 ||
      values.destination !== undefined ||
      values.stdin ||
      positionals.length > 0
    ) {
      throw new UsageError('--list cannot be combined with a message, files, or other options.');
    }
    return { kind: 'list' };
  }
  if (values.stdin && positionals.length > 0) {
    throw new UsageError('Give the message as words or with --stdin, not both.');
  }
  if (files.some((file) => file.trim() === '')) {
    throw new UsageError('--file needs a file path.');
  }
  if (values.destination?.trim() === '') {
    throw new UsageError('--destination needs a destination name.');
  }

  return {
    kind: 'share',
    // Unquoted words are joined, so `devshare please check this` works like the quoted form.
    text: positionals.length > 0 ? positionals.join(' ') : undefined,
    stdin: values.stdin === true,
    files,
    destination: values.destination,
  };
}
