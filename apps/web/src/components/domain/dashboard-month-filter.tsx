"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

export function DashboardMonthFilter({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-[14rem]">
      <label htmlFor="dashboard-bulan" className="text-label text-ink-soft">
        Filter bulan
      </label>
      <Select
        id="dashboard-bulan"
        ariaLabel="Filter bulan dashboard"
        value={value}
        options={options}
        onValueChange={(next) => {
          const params = new URLSearchParams(searchParams.toString());
          if (next === "all") params.delete("bulan");
          else params.set("bulan", next);
          const query = params.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
      />
    </div>
  );
}
