import { Card } from "@/components/ui/card";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { ADMIN_ORDER_COLUMNS } from "@/components/domain/admin-order-table";

export default function AdminOrdersLoading() {
  return (
    <>
      <div className="mb-5 sm:mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-[32rem] max-w-full" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>

        <div className="flex gap-1.5 border-t border-hairline px-4 py-3 sm:px-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-24" />
          ))}
        </div>

        <div className="border-t border-hairline">
          <TableSkeleton columns={ADMIN_ORDER_COLUMNS} rows={10} />
        </div>
      </Card>
    </>
  );
}
