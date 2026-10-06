import assert from "node:assert/strict";
import { test } from "node:test";
import { jidPhone, normalizeWhatsappNumber, reactionAction } from "./admin-reaction-parser";
import { messageKey } from "../whatsapp/waha.client";
import { adminOrderCardText, adminReactionReplyText } from "../whatsapp/whatsapp-messages";

test("reaction emoji map to order actions", () => {
  assert.equal(reactionAction("⏳"), "take");
  assert.equal(reactionAction("⌛"), "take");
  assert.equal(reactionAction("✅"), "done");
  assert.equal(reactionAction("✔️"), "done");
  assert.equal(reactionAction("❌"), "reject");
  assert.equal(reactionAction(""), null);
  assert.equal(reactionAction("👍"), null);
  assert.equal(reactionAction("🙏🏽"), null);
});

test("phone JIDs give digits; LIDs and groups do not", () => {
  assert.equal(jidPhone("6281234567890@c.us"), "6281234567890");
  assert.equal(jidPhone("6281234567890@s.whatsapp.net"), "6281234567890");
  assert.equal(jidPhone("6281234567890:12@s.whatsapp.net"), "6281234567890");
  assert.equal(jidPhone("123456789012345@lid"), null);
  assert.equal(jidPhone("120363427454043461@g.us"), null);
});

test("admin WhatsApp numbers are stored as 62 digits", () => {
  assert.equal(normalizeWhatsappNumber("0812-3456-7890"), "6281234567890");
  assert.equal(normalizeWhatsappNumber("+62 812 3456 7890"), "6281234567890");
  assert.equal(normalizeWhatsappNumber("6281234567890"), "6281234567890");
});

test("reactions match cards on the bare message id", () => {
  assert.equal(
    messageKey("true_120363427454043461@g.us_3EB0A1B2C3D4E5F6_6281234567890@c.us"),
    "3EB0A1B2C3D4E5F6",
  );
  assert.equal(messageKey("true_120363427454043461@g.us_3EB0A1B2C3D4E5F6"), "3EB0A1B2C3D4E5F6");
  assert.equal(messageKey("3EB0A1B2C3D4E5F6"), "3EB0A1B2C3D4E5F6");
});

test("admin group card and replies", () => {
  const card = adminOrderCardText({
    orderId: "ZT2610060012",
    serviceName: "1B",
    inputType: "imei",
    imei: "353249109618062",
    notes: "cepat ya",
  });
  assert.match(card, /ZT2610060012/);
  assert.match(card, /IMEI: `353249109618062`/);
  assert.match(card, /📝 cepat ya/);
  assert.match(card, /⏳ proses · ✅ done · ❌ tolak/);
  assert.doesNotMatch(
    adminOrderCardText({ orderId: "X", serviceName: "S", inputType: "none", imei: "-" }),
    /IMEI/,
  );
  assert.equal(adminReactionReplyText({ kind: "done", adminName: "Admin HJ" }), "Done ✅ · Admin HJ");
  assert.match(
    adminReactionReplyText({ kind: "rejected", adminName: "Admin HJ", refunded: true }),
    /dikembalikan/,
  );
});
