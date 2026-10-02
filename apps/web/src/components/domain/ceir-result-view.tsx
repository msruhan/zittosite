import { cn } from "@/lib/utils";
import { formatCeirAction, parseCeirResult, type CeirResultLine } from "@/lib/ceir-result";

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
  const showImsi = history.some((event) => event.imsi);

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

      {history.length ? (
        <div className="min-w-0">
          <p className="mb-2 text-label font-bold uppercase tracking-[0.08em] text-ink-soft">
            Riwayat
            <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-faint">
              · {history.length} entri
            </span>
          </p>
          <div className="overflow-x-auto overscroll-x-contain rounded-md border border-hairline">
            <table className="w-max min-w-full border-collapse text-left text-label">
              <thead>
                <tr className="bg-mist/50">
                  <Th className="w-8 text-center">No</Th>
                  <Th>Tanggal</Th>
                  {showImsi ? <Th>IMSI</Th> : null}
                  <Th>Aksi</Th>
                  <Th>Catatan</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((event, index) => (
                  <tr
                    key={`${event.date}-${index}`}
                    className="border-t border-hairline/70 align-top"
                  >
                    <Td className="text-center text-ink-faint">{index + 1}</Td>
                    <Td className="font-data tabular text-ink">{event.date}</Td>
                    {showImsi ? (
                      <Td className="font-data tabular text-ink-soft">{event.imsi ?? "—"}</Td>
                    ) : null}
                    <Td className="font-bold lowercase text-ink">
                      {formatCeirAction(event.action)}
                    </Td>
                    <Td className="text-ink-soft">{event.note ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-3 py-2 text-label font-bold uppercase tracking-[0.04em] text-ink-soft",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn("whitespace-nowrap px-3 py-2", className)}>{children}</td>;
}
