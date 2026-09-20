import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { qrPngBuffer, qrSvgString } from "@/lib/qr";

function decodePng(buffer: Buffer): string | null {
  const png = PNG.sync.read(buffer);
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return result?.data ?? null;
}

describe("master QR code", () => {
  it("encodes exactly the configured URL and nothing else", async () => {
    const url = "https://directory.example.org";
    expect(decodePng(await qrPngBuffer(url))).toBe(url);
  });

  it("keeps paths and query strings byte-for-byte", async () => {
    const url = "https://directory.example.org/volunteers?ref=id-card";
    expect(decodePng(await qrPngBuffer(url))).toBe(url);
  });

  it("produces the identical image every time (one master code for all cards)", async () => {
    const url = "https://directory.example.org";
    const [a, b] = await Promise.all([qrPngBuffer(url), qrPngBuffer(url)]);
    expect(a.equals(b)).toBe(true);
  });

  it("encodes a different URL differently", async () => {
    const a = await qrPngBuffer("https://directory.example.org");
    const b = await qrPngBuffer("https://other.example.org");
    expect(a.equals(b)).toBe(false);
  });

  it("scans at a small print size", async () => {
    const url = "https://directory.example.org";
    expect(decodePng(await qrPngBuffer(url, 300))).toBe(url);
  });

  it("renders a valid SVG with black modules on a white background", async () => {
    const svg = await qrSvgString("https://directory.example.org");
    expect(svg).toContain("<svg");
    expect(svg).toMatch(/#000000/i);
    expect(svg).toMatch(/#ffffff/i);
  });
});
