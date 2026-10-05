import { describe, expect, it } from 'vitest';

import { DevShareError, createSharePayload, type Attachment } from '../src/index.js';

const screenshot: Attachment = {
  name: 'screenshot.png',
  mediaType: 'image/png',
  data: new Uint8Array([1, 2, 3]),
};

function expectDevShareError(action: () => unknown, code: DevShareError['code']): void {
  expect(action).toThrow(DevShareError);
  expect(action).toThrow(expect.objectContaining({ code }));
}

describe('createSharePayload', () => {
  it('creates a text-only payload', () => {
    expect(createSharePayload({ text: 'Please check this issue' })).toEqual({
      text: 'Please check this issue',
      attachments: [],
    });
  });

  it('creates an attachment-only payload', () => {
    expect(createSharePayload({ attachments: [screenshot] })).toEqual({
      attachments: [screenshot],
    });
  });

  it('combines text and multiple attachments into one payload', () => {
    const log: Attachment = {
      name: 'error.log',
      mediaType: 'text/plain',
      data: new Uint8Array([4]),
    };

    const payload = createSharePayload({ text: 'See attached', attachments: [screenshot, log] });

    expect(payload.text).toBe('See attached');
    expect(payload.attachments).toEqual([screenshot, log]);
  });

  it('keeps text verbatim, including indentation and trailing newlines', () => {
    const code = '  if (x) {\n    return y;\n  }\n';

    expect(createSharePayload({ text: code }).text).toBe(code);
  });

  it('drops whitespace-only text when attachments are present', () => {
    expect(createSharePayload({ text: ' \n\t', attachments: [screenshot] })).toEqual({
      attachments: [screenshot],
    });
  });

  it.each([
    ['no input', {}],
    ['whitespace-only text', { text: '   \n' }],
    ['an empty attachment list', { attachments: [] }],
  ])('rejects a payload with %s', (_label, input) => {
    expectDevShareError(() => createSharePayload(input), 'EMPTY_PAYLOAD');
  });

  it('rejects an attachment without a name', () => {
    expectDevShareError(
      () => createSharePayload({ attachments: [{ ...screenshot, name: ' ' }] }),
      'INVALID_ATTACHMENT',
    );
  });

  it('rejects an empty attachment', () => {
    expectDevShareError(
      () => createSharePayload({ attachments: [{ ...screenshot, data: new Uint8Array() }] }),
      'INVALID_ATTACHMENT',
    );
  });
});
