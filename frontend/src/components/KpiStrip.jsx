import { Layers, AlertTriangle, TrendingUp, Bot, Percent } from "lucide-react";

function Kpi({ label, value, sub, accent, Icon, onClick }) {
  return (
    <div
      onClick={onClick}
      className="glass glass-hover px-4 sm:px-5 py-4 sm:py-5 min-w-0 group cursor-pointer transition-all duration-300"
    >
      <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
        {Icon && <Icon className="w-4 h-4 text-muted group-hover:text-brand transition-colors flex-shrink-0" strokeWidth={2} />}
        <div className="text-xs sm:text-sm text-muted font-medium truncate">{label}</div>
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span
          className="text-2xl sm:text-3xl font-bold font-heading leading-tight"
          style={accent ? { color: accent } : undefined}
        >
          {value}
        </span>
        {sub && <span className="text-xs sm:text-sm text-muted">{sub}</span>}
      </div>
    </div>
  );
}

export default function KpiStrip({ kpis, onKpiClick }) {
  if (!kpis) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      <Kpi
        label="Active clusters"
        value={kpis.active_clusters}
        sub="harm patterns"
        Icon={Layers}
        onClick={() => onKpiClick && onKpiClick("active")}
      />
      <Kpi
        label="Critical"
        value={kpis.critical_clusters}
        accent="#dc2626"
        sub="need review"
        Icon={AlertTriangle}
        onClick={() => onKpiClick && onKpiClick("critical")}
      />
      <Kpi
        label="Escalating"
        value={kpis.escalating_clusters}
        accent="#ea580c"
        sub="+growth"
        Icon={TrendingUp}
        onClick={() => onKpiClick && onKpiClick("escalating")}
      />
      <Kpi
        label="AI-related cases"
        value={kpis.ai_cases?.toLocaleString()}
        sub={`of ${kpis.total_fetched?.toLocaleString()}`}
        Icon={Bot}
      />
      <Kpi
        label="Match rate"
        value={`${kpis.match_rate}%`}
        sub="AI / all complaints"
        Icon={Percent}
      />
    </div>
  );
}

