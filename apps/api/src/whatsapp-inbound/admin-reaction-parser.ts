export type ReactionAction = "take" | "done" | "reject";

/** Order action for a reaction emoji, or null for any other (or a removed) reaction. */
export function reactionAction(emoji: string): ReactionAction | null {
  const bare = emoji.replace(/[\uFE0F\u{1F3FB}-\u{1F3FF}]/gu, "").trim();
  if (bare === "⏳" || bare === "⌛" || bare === "🔄") return "take";
  if (bare === "✅" || bare === "✔" || bare === "☑") return "done";
  if (bare === "❌" || bare === "✖" || bare === "❎") return "reject";
  return null;
}

/** "/hitung" (optionally followed by text) asks for the sender's daily order count. */
export function isCountCommand(text: string): boolean {
  return /^\/hitung(?:\s|$)/i.test(text.trim());
}

/** Digits of a WhatsApp phone JID (`628…@c.us` / `@s.whatsapp.net`); null for LIDs and groups. */
export function jidPhone(jid: string): string | null {
  const match = /^(\d{6,20})(?::\d+)?@(c\.us|s\.whatsapp\.net)$/.exec(jid);
  return match ? match[1]! : null;
}

/**
 * WhatsApp number as stored: digits only, no leading +.
 * Local Indonesian 08… becomes 628…; 00… is an international prefix and is dropped.
 * Other country codes (60…, 65…, 1…) stay as entered.
 */
export function normalizeWhatsappNumber(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  return digits;
}
