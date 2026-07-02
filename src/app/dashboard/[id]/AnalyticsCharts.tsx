// AnalyticsCharts.tsx — client island that renders the click charts with
// Recharts (Recharts is browser-only, so this must be a client component). The
// server page does all the querying and aggregation and passes plain arrays in.
"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export type DailyPoint = { date: string; clicks: number };
export type Breakdown = { label: string; count: number };

const AXIS = { fill: "rgba(255,255,255,0.5)", fontSize: 12 };
const TOOLTIP_STYLE = {
  background: "#0f172a",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  color: "white",
};

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="mb-4 text-sm font-semibold text-white/70">{title}</h2>
      {children}
    </div>
  );
}

export default function AnalyticsCharts({
  daily,
  referrers,
  countries,
}: {
  daily: DailyPoint[];
  referrers: Breakdown[];
  countries: Breakdown[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Clicks over the last 14 days">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={daily} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "rgba(255,255,255,0.15)" }} />
            <Line
              type="monotone"
              dataKey="clicks"
              stroke="#818cf8"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Top referrers">
          {referrers.length === 0 ? (
            <p className="text-sm text-white/40">No clicks yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={referrers}
                layout="vertical"
                margin={{ top: 0, right: 12, bottom: 0, left: 20 }}
              >
                <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Bar dataKey="count" fill="#c084fc" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Top countries">
          {countries.length === 0 ? (
            <p className="text-sm text-white/40">No location data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={countries}
                layout="vertical"
                margin={{ top: 0, right: 12, bottom: 0, left: 20 }}
              >
                <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Bar dataKey="count" fill="#34d399" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </div>
  );
}
