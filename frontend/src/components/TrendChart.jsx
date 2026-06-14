import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Panel, SEVERITY_HEX } from "../ui.jsx";

// Stacked area: case volume by severity over the trailing window.
export default function TrendChart({ trend }) {
  return (
    <Panel title="Alert Volume Trend" subtitle="trailing window · by severity" className="h-full">
      <div className="p-3 h-full min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <defs>
              {Object.entries(SEVERITY_HEX).map(([k, hex]) => (
                <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={hex} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={hex} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6B7280" }} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} />
            <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #E5E7EB", backgroundColor: "#FFFFFF", boxShadow: "0 8px 30px rgba(0,0,0,0.08)", color: "#111827" }}
              labelStyle={{ color: "#0F172A", fontWeight: 600 }}
              itemStyle={{ color: "#4B5563" }}
            />
            {/* Stack low→critical so critical sits on top. */}
            {["low", "medium", "high", "critical"].map((sev) => (
              <Area
                key={sev}
                type="monotone"
                dataKey={sev}
                stackId="1"
                stroke={SEVERITY_HEX[sev.toUpperCase()]}
                fill={`url(#g-${sev.toUpperCase()})`}
                strokeWidth={1.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
