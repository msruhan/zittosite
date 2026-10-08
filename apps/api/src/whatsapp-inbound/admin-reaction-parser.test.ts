import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCountCommand,
  jidPhone,
  normalizeWhatsappNumber,
  reactionAction,
} from "./admin-reaction-parser";
import { wibToday } from "./admin-reaction.service";
import { adminDailyCountText } from "../whatsapp/whatsapp-messages";

test("/hitung command and daily count reply", () => {
  assert.equal(isCountCommand("/hitung"), true);
  assert.equal(isCountCommand("  /HITUNG hari ini"), true);
  assert.equal(isCountCommand("/hitungan"), false);
  assert.equal(isCountCommand("hitung"), false);

  const text = adminDailyCountText({
    adminName: "msruhan",
    date: "07-10-2026",
    rows: [
      { time: "08:06", imei: "358073465407810", status: "done" },
      { time: "09:55", imei: "353909595487591", status: "in_process" },
      { time: "11:30", imei: "359237633614420", status: "rejected" },
    ],
  });
  assert.match(text, /Order Hari Ini — msruhan\*\n📅 07-10-2026/);
  assert.match(text, /1\. \[08:06\] 358073465407810 ✅\n2\. \[09:55\] 353909595487591 ⏳\n3\. \[11:30\] 359237633614420 ❌/);
  assert.match(text, /Total IMEI masuk : 3\n✅ Done : 1\n⏳ Proses : 1\n❌ Ditolak : 1/);
  assert.match(adminDailyCountText({ adminName: "a", date: "x", rows: [] }), /Belum ada order/);

  // 01:43 WIB on 8 Oct is still 7 Oct in UTC.
  const today = wibToday(new Date("2026-10-07T18:43:00Z"));
  assert.equal(today.label, "08-10-2026");
  assert.equal(today.start.toISOString(), "2026-10-07T17:00:00.000Z");
});
import { messageKey, parseGroups, selfIds } from "../whatsapp/waha.client";
import { adminOrderCardText, adminReactionReplyText } from "../whatsapp/whatsapp-messages";
import { whatsappGroupFor } from "../admin/admin-services.service";

test("WAHA group lists parse across engines", () => {
  assert.deepEqual(
    parseGroups([
      { JID: "120363430578838522@g.us", Name: "Admin Pemroses 3" },
      { id: { _serialized: "120363430035270890@g.us" }, subject: "Admin Pemroses 1" },
      { id: "6281@c.us", name: "not a group" },
    ]),
    [
      { id: "120363430035270890@g.us", name: "Admin Pemroses 1" },
      { id: "120363430578838522@g.us", name: "Admin Pemroses 3" },
    ],
  );
  assert.deepEqual(parseGroups({ "1@g.us": { id: "1@g.us" } }), [{ id: "1@g.us", name: "1@g.us" }]);
  assert.deepEqual(parseGroups(null), []);

  const self = selfIds({
    id: "6287898440760@c.us",
    lid: "240381467865178@lid",
    jid: "6287898440760:1@s.whatsapp.net",
  });
  assert.deepEqual(
    parseGroups(
      [
        {
          JID: "1@g.us",
          Name: "Admin Pemroses 1",
          Participants: [{ JID: "240381467865178@lid", PhoneNumber: "6287898440760@s.whatsapp.net" }],
        },
        {
          JID: "2@g.us",
          Name: "ADMIN iC",
          Participants: [{ JID: "162706313236640@lid", PhoneNumber: "6289612322511@s.whatsapp.net" }],
        },
      ],
      self,
    ).map((g) => g.name),
    ["Admin Pemroses 1"],
  );
});

test("WhatsApp Admin services require a group; other channels clear it", () => {
  const prev = process.env.WA_GROUP_CHAT_ID;
  process.env.WA_GROUP_CHAT_ID = "999@g.us";
  try {
    assert.equal(whatsappGroupFor("telegram", "1@g.us", "2@g.us"), null);
    assert.equal(whatsappGroupFor("whatsapp_admin", "1@g.us"), "1@g.us");
    assert.equal(whatsappGroupFor("whatsapp_admin", undefined, "2@g.us"), "2@g.us");
    assert.throws(() => whatsappGroupFor("whatsapp_admin", null, "2@g.us"), /Pilih grup/);
    assert.throws(() => whatsappGroupFor("whatsapp_admin", "abc"), /tidak valid/);
  } finally {
    if (prev === undefined) delete process.env.WA_GROUP_CHAT_ID;
    else process.env.WA_GROUP_CHAT_ID = prev;
  }
});

test("reaction emoji map to order actions", () => {
  assert.equal(reactionAction("⏳"), "take");
  assert.equal(reactionAction("⌛"), "take");
  assert.equal(reactionAction("🔄"), "take");
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
  assert.equal(
    adminOrderCardText({ serviceName: "Layanan Tes Api 3B", inputType: "imei", imei: "357001184891312" }),
    "Layanan Tes Api 3B\n357001184891312",
  );
  assert.equal(
    adminOrderCardText({ serviceName: "1B", inputType: "imei", imei: "353249109618062", isTest: true }),
    "🧪 *TESTING*\n1B\n353249109618062",
  );
  assert.equal(adminOrderCardText({ serviceName: "S", inputType: "none", imei: "-" }), "S");
  assert.equal(adminReactionReplyText({ kind: "done", adminName: "Admin HJ" }), "Done ✅ · Admin HJ");
  assert.match(
    adminReactionReplyText({ kind: "rejected", adminName: "Admin HJ", refunded: true }),
    /dikembalikan/,
  );
});
