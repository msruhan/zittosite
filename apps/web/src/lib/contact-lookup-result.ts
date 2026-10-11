/** Phone lookup results (InfoCeir Getcontact, GContact+): profile lines, e-wallets and saved-name tags. */

export interface ContactTag {
  name: string;
  /** How many contacts saved the number under this name. */
  count: number | null;
}

export interface ContactWallet {
  provider: string;
  name: string;
}

export interface ContactLookupResult {
  /** Label/value lines in arrival order (Nama, Jumlah tag, WhatsApp, …). */
  details: Array<{ label: string; value: string }>;
  wallets: ContactWallet[];
  tags: ContactTag[];
  summary: string | null;
}

/** InfoCeir: "Tag 12: Om Dandung (Count: 5)". */
const NUMBERED_TAG = /^Tag \d+:\s*(.+?)(?:\s*\(Count:\s*(\d+)\))?$/i;
/** GContact+: "Tag (25 teratas dari 120)" followed by "• Indobypass (99)" lines. */
const TAG_HEADER = /^Tag \((?:\d+ teratas dari )?\d+\)$/i;
const BULLET_TAG = /^•\s*(.+?)(?:\s*\((\d+)\))?$/;
const WALLET_ENTRY = /^(.*?)\s*\(Provider:\s*([^)]+)\)$/i;
const LABEL_LINE = /^([A-Za-z][A-Za-z0-9 ._()/+-]{0,30}):\s*(.+)$/;

const WALLET_NAMES: Record<string, string> = {
  gopay: "GoPay",
  ovo: "OVO",
  dana: "DANA",
  shopeepay: "ShopeePay",
  linkaja: "LinkAja",
};

const LABELS: Record<string, string> = {
  nama: "Nama",
  "jumlah tag": "Jumlah tag",
  whatsapp: "WhatsApp",
};

/** "Registered: true; Is business: false" → "Terdaftar · akun pribadi". */
function whatsappValue(value: string): string {
  const registered = /registered:\s*(true|false)/i.exec(value)?.[1];
  if (!registered) return value;
  if (registered.toLowerCase() === "false") return "Tidak terdaftar";
  const business = /is business:\s*(true|false)/i.exec(value)?.[1]?.toLowerCase();
  return business === "true" ? "Terdaftar · akun bisnis" : business === "false" ? "Terdaftar · akun pribadi" : "Terdaftar";
}

function tagFrom(match: RegExpExecArray): ContactTag {
  return { name: match[1]!.trim(), count: match[2] ? Number(match[2]) : null };
}

/** Null unless the text lists saved-name tags; other results keep their usual layout. */
export function parseContactLookup(text: string | null | undefined): ContactLookupResult | null {
  const result: ContactLookupResult = { details: [], wallets: [], tags: [], summary: null };
  let inTagList = false;
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const numbered = NUMBERED_TAG.exec(line);
    if (numbered) {
      result.tags.push(tagFrom(numbered));
      continue;
    }
    if (TAG_HEADER.test(line)) {
      inTagList = true;
      continue;
    }
    const bullet = inTagList ? BULLET_TAG.exec(line) : null;
    if (bullet) {
      result.tags.push(tagFrom(bullet));
      continue;
    }
    inTagList = false;

    const pair = LABEL_LINE.exec(line);
    if (!pair) {
      result.details.push({ label: "Info", value: line });
      continue;
    }
    const key = pair[1]!.trim().toLowerCase();
    const value = pair[2]!.trim();
    if (key === "e-wallet") {
      for (const entry of value.split(/\s*;\s*/)) {
        const wallet = WALLET_ENTRY.exec(entry);
        if (!wallet) continue;
        const provider = wallet[2]!.trim();
        result.wallets.push({
          provider: WALLET_NAMES[provider.toLowerCase()] ?? provider,
          name: wallet[1]!.trim() || "—",
        });
      }
      if (!result.wallets.length) result.details.push({ label: "E-wallet", value });
    } else if (key === "ringkasan" || key === "summary") {
      result.summary = value;
    } else {
      result.details.push({
        label: LABELS[key] ?? pair[1]!.trim(),
        value: key === "whatsapp" ? whatsappValue(value) : value,
      });
    }
  }
  return result.tags.length ? result : null;
}
