import { describe, expect, it, vi } from 'vitest';

import { createDiscordTransportFactory } from '../src/transports/discord.js';
import {
  createSharePayload,
  DevShareError,
  type DestinationConfig,
  type DevShareErrorCode,
  type SharePayload,
} from '../src/index.js';

/** Obviously fake webhook used only in tests; it is never contacted. */
const WEBHOOK_URL = 'https://discord.com/api/webhooks/123456789/fake-token-for-tests';
const WEBHOOK_ENV = 'DEVSHARE_TEST_WEBHOOK';

const destination: DestinationConfig = {
  name: 'backend',
  type: 'discord',
  settings: { webhookEnv: WEBHOOK_ENV },
};

function setup(
  respond: () => Promise<Response> = () => Promise.resolve(new Response(null, { status: 204 })),
) {
  const fetch = vi.fn<typeof globalThis.fetch>(respond);
  const factory = createDiscordTransportFactory({ fetch });
  const transport = factory.create(destination, { [WEBHOOK_ENV]: WEBHOOK_URL });
  return { fetch, transport };
}

function sentForm(fetch: ReturnType<typeof setup>['fetch']): FormData {
  const body = fetch.mock.calls[0]?.[1]?.body;
  if (!(body instanceof FormData)) {
    throw new Error('Expected a multipart form body');
  }
  return body;
}

function sentPayloadJson(form: FormData): unknown {
  const json = form.get('payload_json');
  if (typeof json !== 'string') {
    throw new Error('Expected a payload_json field');
  }
  return JSON.parse(json);
}

function attachment(name: string, bytes: number[] = [1, 2, 3]) {
  return { name, mediaType: 'image/png', data: new Uint8Array(bytes) };
}

async function expectSendError(
  payload: SharePayload,
  transport: ReturnType<typeof setup>['transport'],
  code: DevShareErrorCode,
): Promise<DevShareError> {
  const error: unknown = await transport.send(payload).catch((e: unknown) => e);
  if (!(error instanceof DevShareError)) {
    throw new Error('Expected send to fail with a DevShareError');
  }
  expect(error.code).toBe(code);
  expect(error.message).not.toContain('fake-token-for-tests');
  return error;
}

describe('Discord transport: sending', () => {
  it('posts text and attachments as one webhook message', async () => {
    const { fetch, transport } = setup();

    await transport.send(
      createSharePayload({
        text: 'Please check this screenshot',
        attachments: [attachment('screenshot.png', [137, 80])],
      }),
    );

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe(WEBHOOK_URL);
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('POST');

    const form = sentForm(fetch);
    expect(sentPayloadJson(form)).toEqual({
      content: 'Please check this screenshot',
      allowed_mentions: { parse: [] },
      attachments: [{ id: 0, filename: 'screenshot.png' }],
    });
    const file = form.get('files[0]');
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe('screenshot.png');
    expect((file as File).type).toBe('image/png');
    expect([...new Uint8Array(await (file as File).arrayBuffer())]).toEqual([137, 80]);
  });

  it('sends a text-only message without files', async () => {
    const { fetch, transport } = setup();

    await transport.send(createSharePayload({ text: 'Please test this' }));

    const form = sentForm(fetch);
    expect(sentPayloadJson(form)).toMatchObject({ content: 'Please test this', attachments: [] });
    expect(form.has('files[0]')).toBe(false);
  });

  it('never lets shared text mention @everyone, roles, or users', async () => {
    const { fetch, transport } = setup();

    await transport.send(createSharePayload({ text: '@everyone the build is broken' }));

    expect(sentPayloadJson(sentForm(fetch))).toMatchObject({ allowed_mentions: { parse: [] } });
  });

  it('sends text longer than a Discord message as message.txt', async () => {
    const { fetch, transport } = setup();
    const longText = 'x'.repeat(2001);

    await transport.send(
      createSharePayload({ text: longText, attachments: [attachment('screenshot.png')] }),
    );

    const form = sentForm(fetch);
    expect(sentPayloadJson(form)).toMatchObject({
      content: '',
      attachments: [
        { id: 0, filename: 'message.txt' },
        { id: 1, filename: 'screenshot.png' },
      ],
    });
    expect(await (form.get('files[0]') as File).text()).toBe(longText);
  });

  it('keeps text of exactly 2000 characters inline', async () => {
    const { fetch, transport } = setup();
    const text = 'x'.repeat(2000);

    await transport.send(createSharePayload({ text }));

    expect(sentPayloadJson(sentForm(fetch))).toMatchObject({ content: text, attachments: [] });
  });

  it('rejects more than 10 attachments without sending anything', async () => {
    const { fetch, transport } = setup();
    const attachments = Array.from({ length: 11 }, (_, i) => attachment(`file-${String(i)}.png`));

    await expectSendError(createSharePayload({ attachments }), transport, 'UNSUPPORTED_PAYLOAD');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('Discord transport: failures', () => {
  const payload = createSharePayload({ text: 'hello' });

  it('reports a network failure without leaking the webhook URL', async () => {
    const networkFailure = new TypeError('fetch failed', {
      cause: Object.assign(new Error(`connect failed ${WEBHOOK_URL}`), { code: 'ENOTFOUND' }),
    });
    const { transport } = setup(() => Promise.reject(networkFailure));

    const error = await expectSendError(payload, transport, 'NETWORK_ERROR');
    expect(error.message).toContain('ENOTFOUND');
    expect(error.cause).toBeUndefined();
  });

  it('reports a timeout', async () => {
    const { transport } = setup(() =>
      Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')),
    );

    const error = await expectSendError(payload, transport, 'NETWORK_ERROR');
    expect(error.message).toContain('Timed out');
  });

  it.each([
    [404, 'invalid or was deleted'],
    [413, 'too large'],
    [429, 'rate limiting'],
    [500, 'HTTP 500'],
  ])('reports a non-success response (HTTP %i)', async (status, expected) => {
    const { transport } = setup(() => Promise.resolve(new Response('{}', { status })));

    const error = await expectSendError(payload, transport, 'DESTINATION_REJECTED');
    expect(error.message).toContain(expected);
  });
});

describe('Discord transport: configuration', () => {
  const factory = createDiscordTransportFactory({ fetch: vi.fn<typeof fetch>() });

  function createWith(settings: Record<string, unknown>, env: Record<string, string>) {
    return () => factory.create({ ...destination, settings }, env);
  }

  it('requires the webhookEnv setting', () => {
    expect(createWith({}, { [WEBHOOK_ENV]: WEBHOOK_URL })).toThrow(
      expect.objectContaining({ code: 'INVALID_DESTINATION' }),
    );
  });

  it('requires the webhook environment variable to be set', () => {
    expect(createWith({ webhookEnv: WEBHOOK_ENV }, {})).toThrow(
      expect.objectContaining({
        code: 'MISSING_SECRET',
        message: `Destination "backend": environment variable ${WEBHOOK_ENV} is not set.`,
      }),
    );
  });

  it.each([
    ['not a URL', 'not-a-url'],
    ['a non-Discord host', 'https://example.com/api/webhooks/123/token'],
    ['plain HTTP', 'http://discord.com/api/webhooks/123/token'],
    ['a non-webhook Discord URL', 'https://discord.com/channels/123/456'],
    ['a look-alike host', 'https://discord.com.example.net/api/webhooks/123/token'],
  ])('rejects a webhook that is %s without echoing it', (_label, url) => {
    const create = createWith({ webhookEnv: WEBHOOK_ENV }, { [WEBHOOK_ENV]: url });

    expect(create).toThrow(expect.objectContaining({ code: 'INVALID_DESTINATION' }));
    expect(create).not.toThrow(url);
  });

  it.each([
    'https://discordapp.com/api/webhooks/123/fake-token',
    'https://canary.discord.com/api/v10/webhooks/123/fake-token',
  ])('accepts the webhook URL form %s', (url) => {
    expect(createWith({ webhookEnv: WEBHOOK_ENV }, { [WEBHOOK_ENV]: url })).not.toThrow();
  });
});
