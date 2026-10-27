import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function saveMenuImage(buffer: Buffer): Promise<string> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !allowed.has(detected.mime)) throw new AppError(400, 'INVALID_IMAGE', 'Choose a JPEG, PNG, or WebP image.');
  const directory = path.resolve(env.uploadPath);
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${detected.ext}`;
  await writeFile(path.join(directory, filename), buffer, { flag: 'wx' });
  return `/uploads/${filename}`;
}
