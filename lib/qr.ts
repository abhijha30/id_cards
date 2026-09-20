import QRCode from "qrcode";

/**
 * Master QR code generation. The payload is ALWAYS the directory URL and nothing else:
 * every ID card carries the identical code.
 *
 * Error correction "Q" (25%) tolerates the wear and lamination glare typical of ID cards
 * while the short URL keeps the symbol small and easy to scan. The 4-module quiet zone is
 * the minimum required by the QR specification.
 */
const COMMON = {
  errorCorrectionLevel: "Q" as const,
  margin: 4,
  color: { dark: "#000000", light: "#ffffff" },
};

export async function qrPngBuffer(url: string, width = 1200): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...COMMON, type: "png", width });
}

export async function qrSvgString(url: string): Promise<string> {
  return QRCode.toString(url, { ...COMMON, type: "svg" });
}

export const QR_FILENAME_BASE = "gdg-noida-directory-qr";
