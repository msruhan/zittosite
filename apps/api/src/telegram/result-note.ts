/** Supplier result text (plain or HTML) as tidy plain-text lines for chat messages. */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const COLOR_DOT: Record<string, string> = {
  green: "🟢",
  red: "🔴",
  orange: "🟠",
};

const DATE_LINE = /^\d{4}-\d{2}-\d{2}\b/;
const BARE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;
const ENTRY_COUNT = /^(Result:\s*)\d+(\s*entr(?:y|ies))$/i;

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(
        /<span[^>]*color\s*:\s*([a-z]+)[^>]*>([\s\S]*?)<\/span>/gi,
        (_, color: string, inner: string) => {
          const dot = COLOR_DOT[color.toLowerCase()];
          return dot ? `${dot} ${inner}` : inner;
        },
      )
      .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  );
}

export function resultNoteLines(raw: string | null | undefined): string[] {
  const text = String(raw ?? "").replace(/\r\n?/g, "\n");
  const plain = /<[a-z][^>]*>/i.test(text) ? htmlToText(text) : text;
  let lines = plain
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  // Check History replies (InfoCeir) put a bare timestamp before each entry with the same time.
  const kept = lines.filter(
    (line) => !(BARE_TIMESTAMP.test(line) && lines.some((other) => other.startsWith(`${line} `))),
  );
  if (kept.length !== lines.length) {
    const entries = kept.filter((line) => DATE_LINE.test(line)).length;
    lines = kept.map((line) => line.replace(ENTRY_COUNT, `$1${entries}$2`));
  }
  return lines;
}

/** Bulleted history entry ("2026-07-17 13:43:07 · add_roamer · SF8080"). */
export function isDatedEntry(line: string): boolean {
  return DATE_LINE.test(line);
}

/** "Model: iPhone 12" → ["Model", "iPhone 12"]; null for lines that are not key/value. */
export function splitLabel(line: string): [string, string] | null {
  const match = /^([A-Za-z][A-Za-z0-9 ._()/+-]{0,30}):\s+(.+)$/.exec(line);
  return match ? [match[1]!, match[2]!] : null;
}
