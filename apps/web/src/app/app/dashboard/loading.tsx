import { Card } from "@/components/ui/card";
import {
  Skeleton,
  StatTileSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";
import { USER_ORDER_COLUMNS } from "@/components/domain/user-order-table";

export default function DashboardLoading() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-2 h-4 w-52" />
      </div>

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatTileSkeleton key={index} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-6 w-44" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        </Card>
        <div className="rounded-lg border border-hairline bg-mist p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-5 w-40" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
      </div>

      <Card>
        <div className="px-4 py-4 sm:px-5">
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="border-t border-hairline">
          <TableSkeleton columns={USER_ORDER_COLUMNS} rows={5} />
        </div>
      </Card>
    </div>
  );
}
