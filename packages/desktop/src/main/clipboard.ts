import { clipboard, nativeImage } from 'electron';

import type { ClipboardContent } from './ipc-handlers.js';

/** Electron offers copied images, including Windows screenshots, in this format. */
const IMAGE_TYPE = 'image/png';

/** Width of the thumbnail shown for a pasted image. */
const PREVIEW_WIDTH = 320;

/** Reads text and any image (as PNG) from the system clipboard. */
export async function readSystemClipboard(): Promise<ClipboardContent> {
  const [text, items] = await Promise.all([clipboard.readText(), clipboard.read()]);
  const imageItem = items.find((item) => item.types.includes(IMAGE_TYPE));
  if (!imageItem) {
    return { text };
  }
  const png = Buffer.from(await (await imageItem.getType(IMAGE_TYPE)).arrayBuffer());
  const image = nativeImage.createFromBuffer(png);
  const preview =
    image.getSize().width > PREVIEW_WIDTH ? image.resize({ width: PREVIEW_WIDTH }) : image;
  return { text, image: { png, previewUrl: preview.toDataURL() } };
}
