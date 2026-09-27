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
    <div className="p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-4 h-3 w-20" />
    </div>
  );
}
