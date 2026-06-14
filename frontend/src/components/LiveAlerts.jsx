import { useState } from "react";
import { Panel } from "../ui.jsx";
import { AlertCircle, AlertTriangle, ShieldAlert } from "lucide-react";

const FILTERS = ["ALL", "CRITICAL", "HIGH", "MEDIUM"];

// Live alert feed with severity filter chips (right column, top).
export default function LiveAlerts({ alerts }) {
  const [filter, setFilter] = useState("ALL");
  const shown = filter === "ALL" ? alerts : alerts.filter((a) => a.severity === filter);

  return (
    <Panel
      title={
        <div className="flex items-center gap-2">
          Live Alerts
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest bg-critical/10 text-critical px-2.5 py-0.5 rounded-full animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-critical"></span>
            LIVE
          </span>
        </div>
      }
      right={
        <div className="flex gap-1 bg-bg p-1 rounded-xl border border-line">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1 rounded-lg transition-all duration-300 ${filter === f ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-bg"
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      }
      className="h-full"
    >
      <ul className="divide-y divide-line">
        {shown.map((a, i) => {
          let Icon = AlertCircle;
          let iconColor = "text-muted";
          let rowBg = "hover:bg-bg";
          let borderStyles = "border-transparent";

          if (a.severity === "CRITICAL") {
            Icon = ShieldAlert;
            iconColor = "text-critical";
            rowBg = "bg-critical/5 hover:bg-critical/10";
            borderStyles = "border-critical shadow-sm";
          } else if (a.severity === "HIGH") {
            Icon = AlertTriangle;
            iconColor = "text-high";
            rowBg = "hover:bg-high/5";
          } else if (a.severity === "MEDIUM") {
            Icon = AlertCircle;
            iconColor = "text-medium";
          }
          return (
            <li
              key={i}
              className={`px-6 py-5 flex gap-4 cursor-pointer transition-all duration-300 border-l-4 ${rowBg} ${borderStyles} group hover:-translate-y-0.5`}
            >
              <div className="flex flex-col items-center pt-1">
                <div className={`p-2 rounded-full bg-white shadow-sm border border-line group-hover:scale-110 transition-transform ${a.severity === 'CRITICAL' ? 'animate-pulse' : ''}`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2} />
                </div>
                <span className="text-xs text-muted font-mono mt-3 opacity-80">{a.time}</span>
              </div>
              <div className="min-w-0 pt-1">
                <span
                  className={`text-xs font-bold tracking-widest uppercase ${iconColor}`}
                >
                  {a.type}
                </span>
                <p className="text-[15px] text-ink leading-relaxed mt-1.5 font-medium pr-4">{a.message}</p>
              </div>
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="px-6 py-8 text-center text-sm text-muted">No {filter.toLowerCase()} alerts.</li>
        )}
      </ul>
    </Panel>
  );
}
