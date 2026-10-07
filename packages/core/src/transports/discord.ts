import { DevShareError } from '../errors.js';
import { systemErrorCode } from '../node-errors.js';
import type { Attachment, SharePayload } from '../payload.js';
import { readSecretSetting } from '../secrets.js';
import type { Transport, TransportFactory } from '../transport.js';

export const DISCORD_TRANSPORT_TYPE = 'discord';

/** Destination setting naming the environment variable that holds the webhook URL. */
const WEBHOOK_SETTING = 'webhookEnv';

// Discord limits for a single webhook message.
const MAX_CONTENT_LENGTH = 2000;
const MAX_ATTACHMENTS = 10;

/** Text longer than a Discord message is sent as a file attachment with this name instead. */
const LONG_TEXT_FILE_NAME = 'message.txt';
const REQUEST_TIMEOUT_MS = 60_000;

const WEBHOOK_HOSTS: ReadonlySet<string> = new Set([
  'discord.com',
  'discordapp.com',
  'canary.discord.com',
  'ptb.discord.com',
]);
const WEBHOOK_PATH = /^\/api(?:\/v\d+)?\/webhooks\/\d+\/[\w-]+\/?$/;

export interface DiscordTransportOptions {
  /** HTTP client; defaults to the global `fetch`. Injected in tests. */
  readonly fetch?: typeof fetch;
}

/** Delivers payloads as a single Discord message through a channel webhook. */
export function createDiscordTransportFactory(
  options: DiscordTransportOptions = {},
): TransportFactory {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  return {
    type: DISCORD_TRANSPORT_TYPE,
    create(destination, env): Transport {
      const secret = readSecretSetting(destination, WEBHOOK_SETTING, env);
      if (!isDiscordWebhookUrl(secret.value)) {
        throw new DevShareError(
          'INVALID_DESTINATION',
          `Destination "${destination.name}": ${secret.variable} is not a Discord webhook URL.`,
        );
      }
      return {
        send: (payload) => postToWebhook(secret.value, payload, destination.name, fetchImpl),
      };
    },
  };
}

async function postToWebhook(
  webhookUrl: string,
  payload: SharePayload,
  destinationName: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  const body = toFormData(payload);

  let response: Response;
  try {
    response = await fetchImpl(webhookUrl, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // The raw error is deliberately not attached as `cause`: HTTP client errors can embed the
    // request URL, which for webhooks is the secret.
    throw networkError(error, destinationName);
  }

  if (!response.ok) {
    throw rejectionError(response.status, destinationName);
  }
}

function toFormData(payload: SharePayload): FormData {
  const attachments: Attachment[] = [...payload.attachments];
  let content = payload.text ?? '';
  if (content.length > MAX_CONTENT_LENGTH) {
    attachments.unshift({
      name: LONG_TEXT_FILE_NAME,
      mediaType: 'text/plain; charset=utf-8',
      data: new TextEncoder().encode(content),
    });
    content = '';
  }
  if (attachments.length > MAX_ATTACHMENTS) {
    throw new DevShareError(
      'UNSUPPORTED_PAYLOAD',
      `Discord allows at most ${String(MAX_ATTACHMENTS)} attachments per message; this share has ${String(attachments.length)}.`,
    );
  }

  const form = new FormData();
  form.append(
    'payload_json',
    JSON.stringify({
      content,
      // Shared text is sent as-is, so never let it ping @everyone, roles, or users.
      allowed_mentions: { parse: [] },
      attachments: attachments.map((attachment, id) => ({ id, filename: attachment.name })),
    }),
  );
  attachments.forEach((attachment, id) => {
    const blob = new Blob([attachment.data], { type: attachment.mediaType });
    form.append(`files[${String(id)}]`, blob, attachment.name);
  });
  return form;
}

/** Whether `value` is an HTTPS Discord channel webhook URL. */
export function isDiscordWebhookUrl(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  return (
    url.protocol === 'https:' && WEBHOOK_HOSTS.has(url.hostname) && WEBHOOK_PATH.test(url.pathname)
  );
}

function networkError(error: unknown, destinationName: string): DevShareError {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return new DevShareError(
      'NETWORK_ERROR',
      `Timed out sending to "${destinationName}" after ${String(REQUEST_TIMEOUT_MS / 1000)} seconds.`,
    );
  }
  const code = error instanceof Error ? systemErrorCode(error.cause) : undefined;
  return new DevShareError(
    'NETWORK_ERROR',
    `Could not reach Discord to share to "${destinationName}"${code ? ` (${code})` : ''}. Check your network connection.`,
  );
}

function rejectionError(status: number, destinationName: string): DevShareError {
  const reason =
    status === 401 || status === 403 || status === 404
      ? 'The webhook is invalid or was deleted; check its URL.'
      : status === 413
        ? 'The attachments are too large for this Discord channel.'
        : status === 429
          ? 'Discord is rate limiting this webhook; try again shortly.'
          : 'Try again later.';
  return new DevShareError(
    'DESTINATION_REJECTED',
    `Discord rejected the share to "${destinationName}" (HTTP ${String(status)}). ${reason}`,
  );
}
