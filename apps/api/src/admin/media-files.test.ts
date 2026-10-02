import assert from "node:assert/strict";
import test from "node:test";
import { detectImageMime } from "./media-files";

test("image type comes from the file bytes, not the name", () => {
  assert.equal(detectImageMime(Buffer.from("89504e470d0a1a0a0000", "hex")), "image/png");
  assert.equal(detectImageMime(Buffer.from("ffd8ffe000104a464946", "hex")), "image/jpeg");
  assert.equal(detectImageMime(Buffer.from("GIF89a....", "ascii")), "image/gif");
  assert.equal(detectImageMime(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "ascii")), "image/webp");
});

test("svg, html and other files are refused", () => {
  assert.equal(detectImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(detectImageMime(Buffer.from("<html><script>1</script></html>")), null);
  assert.equal(detectImageMime(Buffer.from("%PDF-1.7")), null);
});
