import assert from "node:assert/strict";
import { test } from "node:test";
import { descriptionToTelegramHtml } from "./telegram-description";

test("plain text keeps every line break exactly and is escaped", () => {
  assert.equal(
    descriptionToTelegramHtml("Harga <1 IMEI> & pajak. \r\n\r\n\r\nBaris dua\nBaris tiga"),
    "Harga &lt;1 IMEI&gt; &amp; pajak.\n\n\nBaris dua\nBaris tiga",
  );
});

test("empty description yields empty string", () => {
  assert.equal(descriptionToTelegramHtml(null), "");
  assert.equal(descriptionToTelegramHtml("   "), "");
});

test("editor HTML keeps bold/italic/links and drops colors and sizes", () => {
  const html =
    '<p><span style="color:rgb(17, 24, 39);font-size:11px"><strong>LOGIN DULU<br />LINK : </strong></span>' +
    '<a target="_blank" href="https://unlocktool.net/post-in"><span><strong>https://unlocktool.net/post-in</strong></span></a></p>' +
    "<p><em>Catatan</em>&nbsp;penting</p>";
  assert.equal(
    descriptionToTelegramHtml(html),
    '<b>LOGIN DULU\nLINK : </b><a href="https://unlocktool.net/post-in"><b>https://unlocktool.net/post-in</b></a>\n\n<i>Catatan</i> penting',
  );
});

test("lists become bullets and unsafe links are dropped", () => {
  assert.equal(
    descriptionToTelegramHtml('<ul><li>Satu</li><li><a href="javascript:alert(1)">Dua</a></li></ul>'),
    "• Satu\n• Dua",
  );
});

test("unclosed tags are closed", () => {
  assert.equal(descriptionToTelegramHtml("<p><strong>Tebal <em>miring</p>"), "<b>Tebal <i>miring</i></b>");
});
