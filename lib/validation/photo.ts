import { MAX_PHOTO_BYTES } from "@/lib/config";

export const PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type PhotoMime = keyof typeof PHOTO_TYPES;

export function isPhotoMime(value: string): value is PhotoMime {
  return Object.prototype.hasOwnProperty.call(PHOTO_TYPES, value);
}

/** Cheap checks on what the browser reports. Returns an error message, or null when acceptable. */
export function validatePhotoMeta(file: { type: string; size: number }): string | null {
  if (!isPhotoMime(file.type)) return "Choose a JPEG, PNG or WebP image.";
  if (file.size <= 0) return "This file is empty.";
  if (file.size > MAX_PHOTO_BYTES) {
    return `This image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The maximum is ${MAX_PHOTO_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}

/** Identifies the real image type from the first bytes (a renamed .exe is not an image). */
export function sniffImageType(bytes: Uint8Array): PhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** Storage object name: <volunteer id>/<random uuid>.<ext>. The original filename is never used. */
export function buildPhotoObjectName(volunteerId: string, mime: PhotoMime, uuid: string = crypto.randomUUID()): string {
  return `${volunteerId}/${uuid}.${PHOTO_TYPES[mime]}`;
}

const PHOTO_PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** True only for paths in the exact shape we generate, inside this volunteer's own folder. */
export function isPhotoPathFor(volunteerId: string, path: string): boolean {
  const match = PHOTO_PATH.exec(path);
  return match !== null && match[1] === volunteerId.toLowerCase();
}
