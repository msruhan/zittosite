export type ProcessorUpdate =
  | { kind: "processing"; imei: string }
  | { kind: "done"; imei: string }
  | { kind: "rejected"; imei: string; reason: string };

const PROCESSING = /IMEI\s*\*?\s*(\d{15})\s*\*?\s*(?:sedang diproses|masuk ke antrian)/gi;
const PROCESSING_LINE = /^.*\bProcessing\b[\s*_]*IMEI\b.*$/gim;
const IMEI_IN_LINE = /(?<!\d)\d{15}(?!\d)/g;
const DONE = /IMEI\s*\*?\s*(\d{15})\s*\*?\s*BERHASIL/gi;
const FAILED = /IMEI\s*\*?\s*(\d{15})\s*\*?\s*GAGAL\b[\s*_.:!-]*(.*)$/gim;
const INVALID_HEADER = /Ada IMEI nggak valid/i;
const INVALID_LINE = /^\s*[•\-]\s*(\d{15})\s*:\s*(.+?)\s*$/gm;
/** Manual done from anyone in the group: `/adddone <imei> [imei…]`. */
const ADD_DONE = /^\s*\/adddone\s+(\d{15}(?:\s+\d{15})*)\s*$/i;
const MAX_REASON = 300;

/** True when the message is `/adddone` with at least one IMEI (any group member may send it). */
export function isAddDoneCommand(text: string): boolean {
  return ADD_DONE.test(text);
}

function cleanReason(value: string): string {
  return value.replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_REASON);
}

/**
 * Status updates in a Roamercheck group message, one per IMEI. Unknown
 * messages yield an empty list.
 *
 * Recognised formats:
 * - `📥 IMEI 354956460645257 masuk ke antrian — …`      → processing
 * - `⏳ IMEI *358790737367981* sedang diproses, …`       → processing
 * - `⏳ *Processing* IMEI *356609236832323* + 353241103298751...` → processing (each IMEI)
 * - `✅ *IMEI 358790737367981 BERHASIL* ✅`               → done
 * - `/adddone 356556102094753`                          → done (manual; any sender)
 * - `❌ IMEI 353941308991338 GAGAL. Coba lagi nanti …`   → rejected
 * - `❌ *Ada IMEI nggak valid:*` + `• <imei>: <reason>`  → rejected
 */
export function parseRoamercheckMessage(text: string): ProcessorUpdate[] {
  const byImei = new Map<string, ProcessorUpdate>();

  const addDone = ADD_DONE.exec(text);
  if (addDone) {
    const imeis = addDone[1]!.match(/\d{15}/g) ?? [];
    return imeis.map((imei) => ({ kind: "done" as const, imei }));
  }

  if (INVALID_HEADER.test(text)) {
    for (const [, imei, reason] of text.matchAll(INVALID_LINE)) {
      const cleaned = cleanReason(reason);
      byImei.set(imei, { kind: "rejected", imei, reason: cleaned || "IMEI tidak valid." });
    }
    return [...byImei.values()];
  }
  for (const [, imei] of text.matchAll(DONE)) {
    byImei.set(imei, { kind: "done", imei });
  }
  for (const [, imei, rest] of text.matchAll(FAILED)) {
    if (byImei.has(imei)) continue;
    const detail = cleanReason(rest);
    byImei.set(imei, {
      kind: "rejected",
      imei,
      reason: detail ? `Gagal diproses. ${detail}` : "Gagal diproses.",
    });
  }
  for (const [, imei] of text.matchAll(PROCESSING)) {
    if (!byImei.has(imei)) byImei.set(imei, { kind: "processing", imei });
  }
  for (const [line] of text.matchAll(PROCESSING_LINE)) {
    for (const [imei] of line.matchAll(IMEI_IN_LINE)) {
      if (!byImei.has(imei)) byImei.set(imei, { kind: "processing", imei });
    }
  }
  return [...byImei.values()];
}
