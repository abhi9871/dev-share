const UTF8_BOM = '\uFEFF';

/** Removes a leading UTF-8 byte-order mark, which Windows editors such as Notepad may add. */
export function stripByteOrderMark(text: string): string {
  return text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
}
