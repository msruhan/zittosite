"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/format";

/**
 * Area chart craft from NextAdmin Payments Overview:
 * smooth stroke, strong gradient fill, dashed grid — blue palette only.
 */
export function RevenueChart({
  data,
}: {
  data: { label: string; revenue: number; orders: number }[];
}) {
  return (
    <div className="h-[280px] w-full sm:h-[310px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#18BFFF" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#18BFFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#E6EBF1"
            strokeDasharray="5 5"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "#6B7280", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="revenue"
            tick={{ fill: "#6B7280", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) =>
              new Intl.NumberFormat("id-ID", {
                notation: "compact",
                compactDisplay: "short",
              }).format(value)
            }
          />
          <YAxis yAxisId="orders" orientation="right" hide />
          <Tooltip
            cursor={{ stroke: "#2563EB", strokeWidth: 1, strokeDasharray: "4 4" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #E6EBF1",
              boxShadow: "0 1px 2px rgba(84,87,118,0.12)",
              fontSize: 13,
            }}
            formatter={(value, name) => {
              if (name === "orders") {
                return [Number(value ?? 0), "Order"];
              }
              return [formatRupiah(Number(value ?? 0)), "Pendapatan"];
            }}
          />
          <Area
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            name="revenue"
            stroke="#2563EB"
            strokeWidth={3}
            fill="url(#revenueFill)"
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Area
            yAxisId="orders"
            type="monotone"
            dataKey="orders"
            name="orders"
            stroke="#18BFFF"
            strokeWidth={2}
            fill="url(#ordersFill)"
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
