import { parseArgs } from 'node:util';

export const USAGE = `Usage: devshare [options] [message...]

Share a message and/or files to a configured destination.

Options:
  -f, --file <path>          Attach a file (repeat for multiple files)
  -d, --destination <name>   Destination to share to (default: from your config)
  -h, --help                 Show this help
  -v, --version              Show the version

Examples:
  devshare "Please check this authentication issue"
  devshare --file screenshot.png "Please check this screenshot"
  devshare --file auth.ts --file publicClient.ts "Please review these"
  devshare --destination backend "Please test this"`;

export type CliCommand =
  | { readonly kind: 'help' }
  | { readonly kind: 'version' }
  | {
      readonly kind: 'share';
      readonly text: string | undefined;
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
    files,
    destination: values.destination,
  };
}
