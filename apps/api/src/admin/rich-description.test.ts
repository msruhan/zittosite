import assert from "node:assert/strict";
import test from "node:test";
import { descriptionToPlain, isRichText, sanitizeDescription } from "./rich-description";

test("plain descriptions are kept as typed", () => {
  assert.equal(sanitizeDescription("  Cek status 1 < 2 & aman  "), "Cek status 1 < 2 & aman");
  assert.equal(isRichText("harga < 5 > 3"), false);
});

test("scripts, handlers and unsafe URLs are removed", () => {
  const dirty =
    '<p onclick="x()">Hi<script>alert(1)</script></p>' +
    '<img src="javascript:alert(1)" onerror="x()">' +
    '<a href="javascript:alert(1)">bad</a>' +
    '<iframe src="https://evil"></iframe>';
  const clean = sanitizeDescription(dirty);
  assert.doesNotMatch(clean, /script|onclick|onerror|javascript|iframe/i);
  assert.match(clean, /<p>Hi<\/p>/);
});

test("editor formatting survives", () => {
  const html =
    '<h2 style="text-align: center">Judul</h2>' +
    '<p><span style="color: #e11d48; font-size: 18px; font-family: Georgia, serif">Merah</span> ' +
    '<strong>tebal</strong> <em>miring</em> <u>garis</u> <mark data-color="#fef08a" style="background-color: #fef08a">stabilo</mark></p>' +
    '<ul><li>satu</li></ul><img src="https://api.example.com/media/abc" alt="foto">' +
    '<a href="https://example.com">link</a>';
  const clean = sanitizeDescription(html);
  assert.match(clean, /text-align:center/);
  assert.match(clean, /color:#e11d48/);
  assert.match(clean, /font-size:18px/);
  assert.match(clean, /<strong>tebal<\/strong>/);
  assert.match(clean, /<img src="https:\/\/api\.example\.com\/media\/abc" alt="foto" \/>/);
  assert.match(clean, /target="_blank"/);
});

test("unknown CSS is dropped", () => {
  const clean = sanitizeDescription('<p style="position: fixed; color: red; background: url(x)">x</p>');
  assert.doesNotMatch(clean, /position|url\(/);
});

test("plain view strips markup", () => {
  assert.equal(
    descriptionToPlain("<h2>Judul</h2><p>Satu &amp; <strong>dua</strong></p><p>Tiga</p>"),
    "Judul\nSatu & dua\nTiga",
  );
});
