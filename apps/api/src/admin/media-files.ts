/** Images Super Admin may upload for service descriptions (no SVG: it can carry script). */
export const MEDIA_MAX_BYTES = 2 * 1024 * 1024;

const SIGNATURES: { mime: string; matches: (b: Buffer) => boolean }[] = [
  { mime: "image/png", matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/gif", matches: (b) => b.subarray(0, 6).toString("ascii").startsWith("GIF8") },
  {
    mime: "image/webp",
    matches: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

/** MIME type detected from the file bytes, or null when it is not an allowed image. */
export function detectImageMime(buffer: Buffer): string | null {
  return SIGNATURES.find((sig) => sig.matches(buffer))?.mime ?? null;
}
