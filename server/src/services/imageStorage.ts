import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);

if (env.cloudinaryConfigured) {
  if (env.CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: env.CLOUDINARY_URL });
  } else {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }
}

async function uploadToCloudinary(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'projectqr',
        resource_type: 'image',
        // Auto-format (WebP/AVIF depending on browser) & Auto-quality compression
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Cloudinary upload returned empty result'));
        } else {
          // Use secure HTTPS URL delivered by Cloudinary CDN
          resolve(result.secure_url);
        }
      }
    );
    uploadStream.end(buffer);
  });
}

export async function saveMenuImage(buffer: Buffer): Promise<string> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !allowed.has(detected.mime)) {
    throw new AppError(400, 'INVALID_IMAGE', 'Choose a JPEG, PNG, or WebP image.');
  }

  // 1. If Cloudinary credentials are configured, upload to Cloudinary CDN
  if (env.cloudinaryConfigured) {
    try {
      const cdnUrl = await uploadToCloudinary(buffer);
      return cdnUrl;
    } catch (error) {
      console.error('Failed to upload image to Cloudinary, falling back to local disk:', error);
      // Clean fallback to local disk storage if Cloudinary network request fails
    }
  }

  // 2. Default/Fallback: Save to server local disk
  const directory = path.resolve(env.uploadPath);
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${detected.ext}`;
  await writeFile(path.join(directory, filename), buffer, { flag: 'wx' });
  return `/uploads/${filename}`;
}
