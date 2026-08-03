import { Card } from "@/components/ui/card";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { USER_ORDER_COLUMNS } from "@/components/domain/user-order-table";

export default function OrderHistoryLoading() {
  return (
    <>
      <div className="mb-5 sm:mb-6">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <div className="border-t border-hairline">
          <TableSkeleton columns={USER_ORDER_COLUMNS} rows={8} />
        </div>
      </Card>
    </>
  );
}
