import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES } from "@/lib/config";
import { buildPhotoObjectName, isPhotoPathFor, sniffImageType, validatePhotoMeta } from "@/lib/validation/photo";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FILE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("validatePhotoMeta", () => {
  it("accepts JPEG, PNG and WebP up to 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validatePhotoMeta({ type, size: 1024 })).toBeNull();
    }
    expect(validatePhotoMeta({ type: "image/png", size: MAX_PHOTO_BYTES })).toBeNull();
  });
  it("rejects other types, empty files and oversized files", () => {
    expect(validatePhotoMeta({ type: "image/gif", size: 10 })).toMatch(/JPEG, PNG or WebP/);
    expect(validatePhotoMeta({ type: "application/pdf", size: 10 })).not.toBeNull();
    expect(validatePhotoMeta({ type: "image/png", size: 0 })).toMatch(/empty/);
    expect(validatePhotoMeta({ type: "image/png", size: MAX_PHOTO_BYTES + 1 })).toMatch(/maximum is 5 MB/);
  });
});

describe("sniffImageType", () => {
  it("recognises real image signatures", () => {
    expect(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(sniffImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffImageType(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  });
  it("rejects renamed non-images", () => {
    expect(sniffImageType(new TextEncoder().encode("<?php echo 1; ?>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("MZ\x90\x00 fake exe"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    // RIFF but not WebP (for example WAV)
    expect(sniffImageType(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
  });
});

describe("photo object names", () => {
  it("builds <volunteer>/<uuid>.<ext> and never uses the original filename", () => {
    expect(buildPhotoObjectName(ID, "image/jpeg", FILE)).toBe(`${ID}/${FILE}.jpg`);
    expect(buildPhotoObjectName(ID, "image/webp", FILE)).toBe(`${ID}/${FILE}.webp`);
    expect(buildPhotoObjectName(ID, "image/png")).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/);
  });
  it("accepts only paths inside the volunteer's own folder", () => {
    expect(isPhotoPathFor(ID, `${ID}/${FILE}.png`)).toBe(true);
    expect(isPhotoPathFor(ID, `${OTHER}/${FILE}.png`)).toBe(false);
    expect(isPhotoPathFor(ID, `${ID}/../${OTHER}/${FILE}.png`)).toBe(false);
    expect(isPhotoPathFor(ID, `${ID}/${FILE}.php`)).toBe(false);
    expect(isPhotoPathFor(ID, `${ID}/evil.jpg`)).toBe(false);
    expect(isPhotoPathFor(ID, `/${ID}/${FILE}.jpg`)).toBe(false);
  });
});
