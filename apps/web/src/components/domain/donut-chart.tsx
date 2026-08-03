"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export type DonutSlice = {
  name: string;
  amount: number;
  color: string;
};

/**
 * Donut craft from NextAdmin "Used Devices" — blue palette for ZITTOSITE.
 */
export function DonutChart({
  data,
  centerLabel = "Total",
  className,
}: {
  data: DonutSlice[];
  centerLabel?: string;
  className?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <div className="relative h-[240px] w-full max-w-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="72%"
              outerRadius="92%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #E6EBF1",
                boxShadow: "0 1px 2px rgba(84,87,118,0.12)",
                fontSize: 13,
              }}
              formatter={(value) => [Number(value ?? 0), "Order"]}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-body font-medium text-ink-soft">{centerLabel}</p>
          <p className="font-data tabular text-metric font-bold text-ink">
            {total}
          </p>
        </div>
      </div>

      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {data.map((slice) => {
          const pct =
            total === 0 ? 0 : Math.round((slice.amount / total) * 1000) / 10;
          return (
            <li
              key={slice.name}
              className="flex items-center gap-2 text-body font-medium text-ink"
            >
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              {slice.name}: {pct}%
            </li>
          );
        })}
      </ul>
    </div>
  );
}
