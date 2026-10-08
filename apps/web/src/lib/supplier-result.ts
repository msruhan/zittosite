/** Supplier result text (plain or HTML) as label/value lines; mirrors apps/api/src/telegram/result-note.ts. */

export type ResultTone = "positive" | "negative" | "warning";

export interface SupplierResultLine {
  /** Null for lines that are not "Label: value". */
  label: string | null;
  value: string;
  tone: ResultTone | null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const COLOR_TONE: Record<string, ResultTone> = {
  green: "positive",
  lime: "positive",
  red: "negative",
  crimson: "negative",
  orange: "warning",
};

const HTML_TAG = /<[a-z][^>]*>/i;
const LABEL_LINE = /^([A-Za-z][A-Za-z0-9 ._()/+-]{0,30}):\s+(.+)$/;
/** Private-use markers for colored spans; stripped after the tags are removed. */
const TONE_MARK = /\uE000(positive|negative|warning)\uE001/g;
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

/** Two-cell table rows read as "label: value"; wider rows join their cells with " · ". */
function tableRowsToLines(html: string): string {
  return html.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row: string) => {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      m[1]!.replace(/<br\s*\/?>/gi, " ").trim(),
    );
    if (!cells.length) return `${row}\n`;
    return `${cells.length === 2 ? `${cells[0]}: ${cells[1]}` : cells.join(" · ")}\n`;
  });
}

/** A flat JSON object reply ({"message":"successfully"}) as "Key: value" lines; null otherwise. */
function jsonReplyLines(text: string): string[] | null {
  if (!/^\s*\{[\s\S]*\}\s*$/.test(text)) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const lines: string[] = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (value === null || typeof value === "object") continue;
      const label = key.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
      lines.push(`${label}: ${String(value)}`);
    }
    return lines.length ? lines : null;
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  return decodeEntities(
    tableRowsToLines(html)
      .replace(
        /<(span|font)[^>]*color\s*[:=]\s*["']?([a-z]+)[^>]*>([\s\S]*?)<\/\1>/gi,
        (_, _tag: string, color: string, inner: string) => {
          const tone = COLOR_TONE[color.toLowerCase()];
          return tone ? `\uE000${tone}\uE001${inner}` : inner;
        },
      )
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<br\s*\/?>|<\/?(ul|ol|table)[^>]*>|<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  );
}

export function hasHtml(text: string | null | undefined): boolean {
  return HTML_TAG.test(text ?? "");
}

/** Non-empty result lines, tone markers kept; Check History duplicates dropped. */
function resultLines(text: string | null | undefined): string[] {
  const raw = String(text ?? "").replace(/\r\n?/g, "\n");
  const plain = jsonReplyLines(raw)?.join("\n") ?? (hasHtml(raw) ? htmlToText(raw) : decodeEntities(raw));
  const lines = plain
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.replace(TONE_MARK, ""));

  // Check History replies (InfoCeir) put a bare timestamp before each entry with the same time.
  const kept = lines.filter(
    (line) => !(BARE_TIMESTAMP.test(line) && lines.some((other) => other.startsWith(`${line} `))),
  );
  if (kept.length === lines.length) return lines;
  const entries = kept.filter((line) => DATE_LINE.test(line)).length;
  return kept.map((line) => line.replace(ENTRY_COUNT, `$1${entries}$2`));
}

/** Plain text of a result: HTML tags removed, one entry per line. */
export function resultPlainText(text: string | null | undefined): string {
  return resultLines(text).join("\n").replace(TONE_MARK, "");
}

export function parseSupplierResult(text: string | null | undefined): SupplierResultLine[] {
  const lines: SupplierResultLine[] = [];
  for (const rawLine of resultLines(text)) {
    const toneMatch = /\uE000(positive|negative|warning)\uE001/.exec(rawLine);
    const line = rawLine.replace(TONE_MARK, "").trim();
    if (!line) continue;
    const pair = LABEL_LINE.exec(line);
    lines.push({
      label: pair ? pair[1]!.trim() : null,
      value: pair ? pair[2]!.trim() : line,
      tone: (toneMatch?.[1] as ResultTone | undefined) ?? null,
    });
  }
  return lines;
}

/** Worth a structured layout: supplier HTML, or more than one line. */
export function isStructuredSupplierResult(text: string | null | undefined): boolean {
  return hasHtml(text) || parseSupplierResult(text).length > 1;
}
