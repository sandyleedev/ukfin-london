import { Layers, AlertTriangle, TrendingUp, Bot, Percent } from "lucide-react";

// Top-line KPI cards.
function Kpi({ label, value, sub, accent, icon: Icon }) {
  return (
    <div className="surface-panel rounded-2xl px-6 py-5 flex-1 min-w-0 transition-transform duration-300 hover:-translate-y-1 group">
      <div className="flex items-center gap-3 mb-2">
        {Icon && <Icon className="w-4 h-4 text-muted group-hover:text-ink transition-colors" strokeWidth={2} />}
        <div className="text-sm text-muted font-medium truncate group-hover:text-ink transition-colors">{label}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold font-heading" style={accent ? { color: accent } : undefined}>{value}</span>
        {sub && <span className="text-sm text-muted font-light">{sub}</span>}
      </div>
    </div>
  );
}

export default function KpiStrip({ kpis }) {
  if (!kpis) return null;
  return (
    <div className="flex gap-4">
      <Kpi label="Active clusters" value={kpis.active_clusters} sub="harm patterns" icon={Layers} />
      <Kpi label="Critical" value={kpis.critical_clusters} accent="#DC2626" sub="need review" icon={AlertTriangle} />
      <Kpi label="Escalating" value={kpis.escalating_clusters} accent="#EA580C" sub="+growth" icon={TrendingUp} />
      <Kpi label="AI-related cases" value={kpis.ai_cases?.toLocaleString()} sub={`of ${kpis.total_fetched?.toLocaleString()}`} icon={Bot} />
      <Kpi label="Match rate" value={`${kpis.match_rate}%`} sub="AI / all complaints" icon={Percent} />
    </div>
  );
}
