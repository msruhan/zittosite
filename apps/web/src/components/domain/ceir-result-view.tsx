import { CeirHistoryTable } from "@/components/domain/ceir-history-table";
import { cn } from "@/lib/utils";
import { parseCeirResult, type CeirResultLine } from "@/lib/ceir-result";

const NEGATIVE = /not\s*found|tidak|error|failed|gagal|invalid|block|blokir|expired/i;

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

/**
 * CEIR supplier result laid out like the CeirBot receipt: a key/value block
 * for Result / Valid until, then a history table. Text that is not in the
 * CEIR format renders as-is.
 */
export function CeirResultView({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const parsed = parseCeirResult(text);

  if (!parsed) {
    return (
      <p className={cn("max-w-[70ch] whitespace-pre-line text-body text-ink", className)}>
        {text}
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
