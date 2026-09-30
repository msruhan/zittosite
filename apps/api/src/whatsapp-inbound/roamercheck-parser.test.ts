import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRoamercheckMessage } from "./roamercheck-parser";

test("queued message means processing", () => {
  assert.deepEqual(
    parseRoamercheckMessage(
      "📥 IMEI 354956460645257 masuk ke antrian — otomatis diproses begitu ada IMEI berikutnya masuk.",
    ),
    [{ kind: "processing", imei: "354956460645257" }],
  );
});

test("in-progress message with bold IMEI means processing", () => {
  assert.deepEqual(
    parseRoamercheckMessage(
      "⏳ IMEI *358790737367981* sedang diproses, dipasangin sama IMEI dari antrian.",
    ),
    [{ kind: "processing", imei: "358790737367981" }],
  );
});

test("success message means done", () => {
  assert.deepEqual(parseRoamercheckMessage("✅ *IMEI 358790737367981 BERHASIL* ✅"), [
    { kind: "done", imei: "358790737367981" },
  ]);
});

test("invalid list rejects each IMEI with its own reason", () => {
  const text = [
    "❌ *Ada IMEI nggak valid:*",
    "• 356789104567891: ❌ check-digit salah (Luhn) — kemungkinan typo, harusnya berakhir *4*",
    "• 358790737367981: 🟡 ROAMER — udah kepake/aktif",
  ].join("\n");
  assert.deepEqual(parseRoamercheckMessage(text), [
    {
      kind: "rejected",
      imei: "356789104567891",
      reason: "❌ check-digit salah (Luhn) — kemungkinan typo, harusnya berakhir 4",
    },
    { kind: "rejected", imei: "358790737367981", reason: "🟡 ROAMER — udah kepake/aktif" },
  ]);
});

test("chatter and unknown formats are ignored", () => {
  assert.deepEqual(parseRoamercheckMessage("keproses wkwk"), []);
  assert.deepEqual(parseRoamercheckMessage("IMEI 12345 BERHASIL"), []);
  assert.deepEqual(parseRoamercheckMessage("• 358790737367981: tanpa header"), []);
});
