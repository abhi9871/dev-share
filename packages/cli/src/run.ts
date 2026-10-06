import {
  createSharePayload,
  DevShareError,
  type Attachment,
  type SharePayload,
  type SharingService,
} from '@devshare/core';

import { parseCliArgs, USAGE, UsageError } from './args.js';

export const EXIT_SUCCESS = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

const CONFIG_HELP_URL = 'https://github.com/abhi9871/dev-share#configuration';

/** Everything the CLI needs from the outside world, injected so it can be tested. */
export interface CliDependencies {
  readonly version: string;
  readonly writeOut: (text: string) => void;
  readonly writeError: (text: string) => void;
  readonly readAttachment: (path: string) => Promise<Attachment>;
  readonly loadSharingService: () => Promise<Pick<SharingService, 'share'>>;
}

/** Runs the CLI and returns the process exit code. */
export async function runCli(argv: readonly string[], deps: CliDependencies): Promise<number> {
  try {
    const command = parseCliArgs(argv);
    switch (command.kind) {
      case 'help':
        deps.writeOut(`${USAGE}\n`);
        return EXIT_SUCCESS;
      case 'version':
        deps.writeOut(`${deps.version}\n`);
        return EXIT_SUCCESS;
      case 'share': {
        const attachments = await Promise.all(
          command.files.map((file) => deps.readAttachment(file)),
        );
        const payload = createSharePayload({ text: command.text, attachments });
        const service = await deps.loadSharingService();
        const result = await service.share(payload, command.destination);
        deps.writeOut(`Shared ${describePayload(payload)} to ${result.destination}.\n`);
        return EXIT_SUCCESS;
      }
    }
  } catch (error) {
    return reportError(error, deps);
  }
}

function reportError(error: unknown, deps: CliDependencies): number {
  if (error instanceof UsageError) {
    deps.writeError(`devshare: ${error.message}\nRun "devshare --help" for usage.\n`);
    return EXIT_USAGE;
  }
  if (error instanceof DevShareError) {
    const hint = error.code === 'CONFIG_NOT_FOUND' ? `\nSee ${CONFIG_HELP_URL}` : '';
    deps.writeError(`devshare: ${error.message}${hint}\n`);
    return EXIT_FAILURE;
  }
  // Unexpected failures are bugs; show the message and stack so they can be reported.
  deps.writeError(
    `devshare: unexpected error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  return EXIT_FAILURE;
}

function describePayload(payload: SharePayload): string {
  const parts: string[] = [];
  if (payload.text !== undefined) {
    parts.push('message');
  }
  const count = payload.attachments.length;
  if (count > 0) {
    parts.push(`${String(count)} ${count === 1 ? 'file' : 'files'}`);
  }
  return parts.join(' and ');
}
