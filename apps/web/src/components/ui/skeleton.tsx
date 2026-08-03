import { cn } from "@/lib/utils";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block animate-skeleton rounded-sm bg-mist", className)}
    />
  );
}

/**
 * A table never renders as a bare header. Row height is held so the layout
 * does not jump when real rows arrive.
 */
export function TableSkeleton({
  columns,
  rows = 5,
}: {
  columns: string[];
  rows?: number;
}) {
  return (
    <TableScroll>
      <Table>
        <THead>
          <TR>
            {columns.map((column) => (
              <TH key={column}>{column}</TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TR key={rowIndex} className="hover:bg-transparent">
              {columns.map((column, colIndex) => (
                <TD key={column}>
                  <Skeleton
                    className={cn(
                      "h-4",
                      colIndex === 0 ? "w-28" : colIndex === 1 ? "w-32" : "w-20",
                    )}
                  />
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </TableScroll>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="card-shell relative overflow-hidden p-5 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
      >
        <span className="card-mesh-blob card-mesh-action" />
        <span className="card-hatch" />
      </div>
      <div className="relative z-10 flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <div className="relative z-10 mt-5 flex items-center gap-2.5 sm:mt-6">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <div className="relative z-10 mt-5 flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}
