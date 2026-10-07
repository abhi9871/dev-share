#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import { loadLocalSharingService, readFileAttachment } from '@devshare/core';

import { runCli } from './run.js';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

process.exitCode = await runCli(process.argv.slice(2), {
  version,
  writeOut: (text) => process.stdout.write(text),
  writeError: (text) => process.stderr.write(text),
  readAttachment: readFileAttachment,
  readStdin,
  loadSharingService: () => loadLocalSharingService(),
});

async function readStdin(): Promise<string> {
  process.stdin.setEncoding('utf8');
  let text = '';
  for await (const chunk of process.stdin) {
    text += String(chunk);
  }
  return text;
}
