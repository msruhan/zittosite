"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

export const CHANNEL_COLOR = {
  web: "#1E63FF",
  telegram: "#0E2F7D",
  api: "#A78BFA",
} as const;

const AXIS_TICK = { fill: "#536070", fontSize: 12 };
const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid #D5DCE4",
  boxShadow: "0 1px 2px rgba(84,87,118,0.12)",
  fontSize: 13,
};
const LEGEND_STYLE = { fontSize: 12, paddingTop: 8 };

function compactRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    compactDisplay: "short",
  }).format(value);
}

/** Each bar is the day's revenue, split into cost (bottom) and profit (top). */
export function ProfitChart({
  data,
  className,
}: {
  data: { label: string; revenue: number; cost: number; profit: number }[];
  className?: string;
}) {
  return (
    <div className={cn("h-[280px] w-full sm:h-[300px]", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#D5DCE4" strokeDasharray="5 5" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={compactRupiah}
          />
          <Tooltip
            cursor={{ fill: "rgba(30,99,255,0.06)" }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [formatRupiah(Number(value ?? 0)), name]}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload as
                | { revenue: number }
                | undefined;
              return row
                ? `${label} · Pendapatan ${formatRupiah(row.revenue)}`
                : label;
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={LEGEND_STYLE} />
          <Bar
            dataKey="cost"
            name="Modal"
            stackId="sale"
            fill="#C9D2DE"
            maxBarSize={28}
          />
          <Bar
            dataKey="profit"
            name="Untung"
            stackId="sale"
            fill="#4ADE80"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChannelTrendChart({
  data,
  className,
}: {
  data: { label: string; web: number; telegram: number; api: number }[];
  className?: string;
}) {
  return (
    <div className={cn("h-[280px] w-full sm:h-[300px]", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#D5DCE4" strokeDasharray="5 5" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(30,99,255,0.06)" }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [`${Number(value ?? 0)} order`, name]}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={LEGEND_STYLE} />
          <Bar dataKey="web" name="Website" stackId="channel" fill={CHANNEL_COLOR.web} maxBarSize={28} />
          <Bar dataKey="telegram" name="Telegram" stackId="channel" fill={CHANNEL_COLOR.telegram} maxBarSize={28} />
          <Bar
            dataKey="api"
            name="API"
            stackId="channel"
            fill={CHANNEL_COLOR.api}
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
