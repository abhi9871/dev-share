import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Writes a file through a temporary file and a rename, so an interrupted write never leaves a
 * half-written file in place. Creates the folder if needed.
 */
export async function writeFileAtomic(path: string, content: string): Promise<void> {
  const temporaryPath = `${path}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporaryPath, content, 'utf8');
  await rename(temporaryPath, path);
}
