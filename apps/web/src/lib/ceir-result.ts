export interface CeirResultLine {
  label: string;
  value: string;
}

export interface CeirHistoryEvent {
  date: string;
  imsi?: string;
  action?: string;
  note?: string;
}

export interface CeirResult {
  /** Result / Valid until / Message lines, in the order they arrived. */
  lines: CeirResultLine[];
  history: CeirHistoryEvent[];
}

const SUMMARY_LINE = /^(result|hasil|status|ceir|valid until|berlaku hingga|message|pesan)\s*:\s*(.*)$/i;
const HISTORY_LINE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?/;
const ACTION = /^[a-z]+(?:_[a-z]+)*$/;

const LABELS: Record<string, string> = {
  result: "Result",
  hasil: "Result",
  status: "Result",
  ceir: "Result",
  "valid until": "Valid until",
  "berlaku hingga": "Valid until",
  message: "Message",
  pesan: "Message",
};

function parseHistoryLine(line: string): CeirHistoryEvent {
  const [date = line, ...rest] = line.split(" · ").map((part) => part.trim());
  const event: CeirHistoryEvent = { date };
  const remaining: string[] = [];
  for (const part of rest) {
    if (!part) continue;
    if (!event.imsi && /^IMSI\s+/i.test(part)) {
      event.imsi = part.replace(/^IMSI\s+/i, "");
    } else if (!event.action && remaining.length === 0 && ACTION.test(part)) {
      event.action = part;
    } else {
      remaining.push(part);
    }
  }
  if (remaining.length) event.note = remaining.join(" · ");
  return event;
}

/**
 * Splits a CEIR supplier result (`Label: value` lines followed by
 * `date · IMSI … · action · note` history rows) into structured parts.
 * Returns null when the text has neither, so callers fall back to plain text.
 */
export function parseCeirResult(text: string | null | undefined): CeirResult | null {
  if (!text?.trim()) return null;
  const lines: CeirResultLine[] = [];
  const history: CeirHistoryEvent[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const summary = SUMMARY_LINE.exec(line);
    if (summary) {
      const label = LABELS[summary[1]!.toLowerCase()] ?? summary[1]!;
      lines.push({ label, value: summary[2]!.trim() || "—" });
    } else if (HISTORY_LINE.test(line)) {
      history.push(parseHistoryLine(line));
    } else {
      return null;
    }
  }
  if (!lines.length && !history.length) return null;
  return { lines, history };
}

export function formatCeirAction(action?: string): string {
  return action ? action.replace(/_/g, " ") : "—";
}
