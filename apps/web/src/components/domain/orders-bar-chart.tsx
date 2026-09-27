"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

/**
 * Rounded column bars — NextAdmin "Campaign Visitors" craft, Action Blue.
 */
export function OrdersBarChart({
  data,
  className,
}: {
  data: { label: string; orders: number }[];
  className?: string;
}) {
  return (
    <div className={cn("h-[230px] w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            stroke="#D5DCE4"
            strokeDasharray="7 7"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "#5C6774", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: "#5C6774", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(20,83,199,0.06)" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #D5DCE4",
              boxShadow: "0 1px 2px rgba(84,87,118,0.12)",
              fontSize: 13,
            }}
            formatter={(value) => [Number(value ?? 0), "Order"]}
          />
          <Bar
            dataKey="orders"
            name="orders"
            fill="#1453C7"
            radius={[999, 999, 999, 999]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
