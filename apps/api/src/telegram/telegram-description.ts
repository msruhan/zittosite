import { escapeHtml } from "./telegram-messages";

/** Telegram has no colors or font sizes; keep the formatting it can render. */
const INLINE_TAGS: Record<string, string> = {
  b: "b",
  strong: "b",
  i: "i",
  em: "i",
  u: "u",
  s: "s",
  strike: "s",
  del: "s",
  code: "code",
};

const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote"]);

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function tidy(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToTelegram(html: string): string {
  let out = "";
  const open: string[] = [];
  const tagRe = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    const [token, rawName, attrs = "", text] = match;
    if (text !== undefined) {
      out += escapeHtml(decodeEntities(text));
      continue;
    }
    const name = rawName!.toLowerCase();
    const closing = token.startsWith("</");
    if (name === "br") {
      out += "\n";
    } else if (name === "li") {
      out += closing ? "\n" : "• ";
    } else if (BLOCK_TAGS.has(name)) {
      if (closing) out += "\n\n";
    } else if (name === "a") {
      const href = /href\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
      if (closing) {
        if (open.at(-1) === "a") out += `</${open.pop()}>`;
      } else if (href && /^https?:\/\//i.test(href)) {
        out += `<a href="${escapeHtml(decodeEntities(href))}">`;
        open.push("a");
      }
    } else if (INLINE_TAGS[name]) {
      const tag = INLINE_TAGS[name]!;
      if (!closing) {
        out += `<${tag}>`;
        open.push(tag);
      } else {
        const at = open.lastIndexOf(tag);
        if (at !== -1) {
          // Close anything nested inside first so the output stays well-formed.
          while (open.length > at) out += `</${open.pop()}>`;
        }
      }
    }
  }
  out = out.trimEnd();
  while (open.length) out += `</${open.pop()}>`;
  return tidy(out.replace(/<(b|i|u|s|code)>(\s*)<\/\1>/g, "$2"));
}

/** Service description (plain text or editor HTML) as Telegram-safe HTML; "" when empty. */
export function descriptionToTelegramHtml(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (!/<[a-z][^>]*>/i.test(value)) {
    // Plain text: every line break the admin typed is kept as-is.
    return escapeHtml(value.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n"));
  }
  return htmlToTelegram(value.replace(/\r\n?/g, "\n").replace(/\n/g, " "));
}
