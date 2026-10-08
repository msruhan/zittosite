import { CeirHistoryTable } from "@/components/domain/ceir-history-table";
import { cn } from "@/lib/utils";
import { parseCeirResult, type CeirResultLine } from "@/lib/ceir-result";
import {
  isStructuredSupplierResult,
  parseSupplierResult,
  resultPlainText,
  type ResultTone,
} from "@/lib/supplier-result";

const NEGATIVE = /not\s*found|tidak|error|failed|gagal|invalid|block|blokir|expired/i;

const TONE_CLASS: Record<ResultTone, string> = {
  positive: "font-semibold text-cleared-ink",
  negative: "font-semibold text-refused-ink",
  warning: "font-semibold text-hold-ink",
};

function displayValue(line: CeirResultLine): string {
  const entries = /^(\d+)\s+entries?$/i.exec(line.value);
  if (entries) return `${entries[1]} entri`;
  return line.label === "Result" ? line.value.toUpperCase() : line.value;
}

const LABEL_ID: Record<string, string> = {
  Result: "Hasil",
  "Valid until": "Berlaku hingga",
  Message: "Pesan",
};

/** Supplier HTML (or multi-line text) as a label/value list, keeping its red/green highlights. */
function SupplierResultList({ text, className }: { text: string; className?: string }) {
  const lines = parseSupplierResult(text);
  return (
    <dl className={cn("rounded-md border border-hairline bg-mist/35 px-4 py-2.5", className)}>
      {lines.map((line, index) =>
        line.label ? (
          <div
            key={index}
            className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-3 py-1.5 text-body"
          >
            <dt className="text-ink-soft after:content-[':']">{line.label}</dt>
            <dd
              className={cn(
                "min-w-0 break-words font-data tabular text-ink",
                line.tone && TONE_CLASS[line.tone],
              )}
            >
              {line.value}
            </dd>
          </div>
        ) : (
          <p
            key={index}
            className={cn(
              "break-words py-1.5 text-body text-ink",
              line.tone && TONE_CLASS[line.tone],
            )}
          >
            {line.value}
          </p>
        ),
      )}
    </dl>
  );
}

/** True when CeirResultView lays the text out instead of printing it as-is. */
export function isStructuredResult(text: string | null | undefined): boolean {
  return Boolean(parseCeirResult(resultPlainText(text))) || isStructuredSupplierResult(text);
}

/**
 * CEIR supplier result laid out like the CeirBot receipt: a key/value block
 * for Result / Valid until, then a history table. Other supplier replies
 * (often HTML) become a label/value list; anything else renders as-is.
 */
export function CeirResultView({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const parsed = parseCeirResult(resultPlainText(text));

  if (!parsed) {
    if (text && isStructuredSupplierResult(text)) {
      return <SupplierResultList text={text} className={className} />;
    }
    return (
      <p className={cn("max-w-[70ch] whitespace-pre-line text-body text-ink", className)}>
        {resultPlainText(text)}
      </p>
    );
  }

  const { lines, history } = parsed;

  return (
    <div className={cn("space-y-4", className)}>
      {lines.length ? (
        <dl className="rounded-md border border-hairline bg-mist/35 px-4 py-2.5">
          {lines.map((line, index) => {
            const value = displayValue(line);
            const isResult = line.label === "Result";
            return (
              <div
                key={`${line.label}-${index}`}
                className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-3 py-1.5 text-body"
              >
                <dt className="text-ink-soft after:content-[':']">
                  {LABEL_ID[line.label] ?? line.label}
                </dt>
                <dd
                  className={cn(
                    "min-w-0 break-words font-data tabular text-ink",
                    isResult && "font-bold tracking-[0.03em]",
                    isResult && NEGATIVE.test(line.value) && "text-refused-ink",
                  )}
                >
                  {value}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}

      {history.length ? <CeirHistoryTable history={history} /> : null}
    </div>
  );
}
