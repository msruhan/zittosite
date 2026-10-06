export type ReactionAction = "take" | "done" | "reject";

/** Order action for a reaction emoji, or null for any other (or a removed) reaction. */
export function reactionAction(emoji: string): ReactionAction | null {
  const bare = emoji.replace(/[\uFE0F\u{1F3FB}-\u{1F3FF}]/gu, "").trim();
  if (bare === "⏳" || bare === "⌛") return "take";
  if (bare === "✅" || bare === "✔" || bare === "☑") return "done";
  if (bare === "❌" || bare === "✖" || bare === "❎") return "reject";
  return null;
}

/** Digits of a WhatsApp phone JID (`628…@c.us` / `@s.whatsapp.net`); null for LIDs and groups. */
export function jidPhone(jid: string): string | null {
  const match = /^(\d{6,20})(?::\d+)?@(c\.us|s\.whatsapp\.net)$/.exec(jid);
  return match ? match[1]! : null;
}

/** Admin WhatsApp number as stored: digits only, local 08… rewritten to 628…. */
export function normalizeWhatsappNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}
