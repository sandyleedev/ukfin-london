import { useMemo, useState } from "react";
import { Panel, SEVERITY_HEX } from "../ui.jsx";
import { ShieldAlert, AlertTriangle, AlertCircle, Info, HelpCircle } from "lucide-react";
import MethodologyModal from "./MethodologyModal.jsx";

const FILTERS = ["ALL", "SPIKE", "RISING", "SIMMERING", "NEW CLUSTER", "TRIAGE FLAG"];

const SEV_ICON = {
  CRITICAL: ShieldAlert,
  HIGH: AlertTriangle,
  MEDIUM: AlertCircle,
  LOW: Info,
};

const FILTER_CLASSES = {
  ALL: {
    active: "bg-brand text-white shadow-sm border-transparent",
    inactive: "text-muted hover:text-ink hover:bg-white/60 border-transparent",
  },
  SPIKE: {
    active: "bg-critical text-white shadow-sm border-transparent",
    inactive: "text-critical hover:bg-critical/10 border-transparent",
  },
  RISING: {
    active: "bg-high text-white shadow-sm border-transparent",
    inactive: "text-high hover:bg-high/10 border-transparent",
  },
  SIMMERING: {
    active: "bg-medium text-white shadow-sm border-transparent",
    inactive: "text-medium hover:bg-medium/10 border-transparent",
  },
  "NEW CLUSTER": {
    active: "bg-low text-white shadow-sm border-transparent",
    inactive: "text-low hover:bg-low/10 border-transparent",
  },
  "TRIAGE FLAG": {
    active: "bg-brand text-white shadow-sm border-transparent",
    inactive: "text-brand hover:bg-brand/10 border-transparent",
  },
};

export default function LiveAlerts({ alerts }) {
  const [filter, setFilter] = useState("ALL");
  const [expanded, setExpanded] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  const filtered = useMemo(() => {
    let list = alerts || [];
    if (filter !== "ALL") list = list.filter((a) => a.type === filter);
    return list;
  }, [alerts, filter]);

  const shown = expanded ? filtered : filtered.slice(0, 5);

  const handleFilterChange = (f) => {
    setFilter(f);
    setExpanded(false);
  };

  return (
    <>
    <Panel
      title={
        <div className="flex items-center gap-2.5">
          <span>Live Alerts</span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest bg-critical/10 text-critical px-2.5 py-1 rounded-full border border-critical/20">
            <span className="w-1.5 h-1.5 rounded-full bg-critical pulse-dot" />
            LIVE
          </span>
          <button
            onClick={() => setShowMethodology(true)}
            title="Why these alerts? See the thresholds & formulas"
            className="flex items-center justify-center w-6 h-6 rounded-md text-muted hover:text-brand hover:bg-accent/40 transition-colors flex-shrink-0"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      }
      right={
        <div className="flex gap-1 bg-accent/50 p-1 rounded-xl border border-line/30 flex-wrap max-w-[400px] md:max-w-none">
          {FILTERS.map((f) => {
            const colors = FILTER_CLASSES[f] || FILTER_CLASSES.ALL;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-lg transition-all duration-200 border ${active ? colors.active : colors.inactive
                  }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      }
      className="h-full"
    >
      <ul>
        {shown.map((a, i) => {
          const Icon = SEV_ICON[a.severity] || Info;
          const color = SEVERITY_HEX[a.severity] || "#61758a";
          const isCrit = a.severity === "CRITICAL";
          return (
            <li
              key={i}
              className={`px-6 py-5 flex gap-4 border-b border-line/20 last:border-b-0 transition-all duration-200 cursor-pointer hover:bg-accent/30 ${isCrit ? "border-l-3 border-l-critical bg-critical/[0.03]" : ""
                }`}
            >
              <div className="flex flex-col items-center pt-0.5 flex-shrink-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isCrit ? "glow-ring-critical" : ""}`}
                  style={{ backgroundColor: `${color}08`, borderColor: `${color}20` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} strokeWidth={2} />
                </div>
                <span className="text-xs text-muted font-mono mt-2.5 opacity-60">{a.time}</span>
              </div>
              <div className="min-w-0 pt-0.5">
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color }}>
                  {a.type}
                </span>
                <p className="text-sm text-ink leading-relaxed mt-1.5 font-medium">{a.message}</p>
              </div>
            </li>
          );
        })}
        {filtered.length > 5 && (
          <li className="px-6 py-4 text-center border-t border-line/20">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm font-semibold text-brand hover:text-brand-dark transition-colors"
            >
              {expanded ? "Collapse alerts ↑" : `View all ${filtered.length} alerts →`}
            </button>
          </li>
        )}
        {shown.length === 0 && (
          <li className="px-6 py-10 text-center text-sm text-muted">No {filter.toLowerCase()} alerts.</li>
        )}
      </ul>
    </Panel>
    {showMethodology && <MethodologyModal onClose={() => setShowMethodology(false)} />}
    </>
  );
}
