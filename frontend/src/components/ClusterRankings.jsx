import { Panel, SeverityBadge, GrowthPill, SEVERITY_HEX } from "../ui.jsx";

export default function ClusterRankings({ clusters, selectedId, onSelect }) {
  return (
    <Panel
      title="Cluster Rankings"
      subtitle={
        <div className="flex flex-col items-start gap-2 mt-1 text-xs text-muted">
          <div>ranked by weighted priority · freq × severity × growth × reg-relevance</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>severity:</span>
            {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((band) => (
              <span key={band} className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: SEVERITY_HEX[band] }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: SEVERITY_HEX[band] }} />
                {band}
              </span>
            ))}
          </div>
        </div>
      }
      className="h-full"
    >
      <ul>
        {clusters.map((c) => {
          const active = c.id === selectedId;
          return (
            <li
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`px-6 py-5 cursor-pointer transition-all duration-300 border-b border-line/20 last:border-b-0 ${active
                ? "bg-accent border-l-3 border-l-brand"
                : "hover:bg-accent/40"
                }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl font-bold text-line w-8 flex-shrink-0 text-center font-heading">{c.rank}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <GrowthPill value={c.growth_7d} />
                    <span className="text-xs text-muted">/ 7 days</span>
                    <SeverityBadge band={c.severity_band} />
                  </div>
                  <p className="text-base font-semibold text-ink leading-snug line-clamp-2">{c.name}</p>
                  <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted mt-2">
                    <span className="font-medium text-brand whitespace-nowrap">{c.category}</span>
                    <span className="text-line">·</span>
                    <span className="whitespace-nowrap">{c.cases.toLocaleString()} cases</span>
                    {c.companies?.length > 0 && (
                      <>
                        <span className="text-line">·</span>
                        <span className="truncate">{c.companies.slice(0, 2).join(", ")}
                          {c.companies.length > 2 && ` +${c.companies.length - 2}`}</span>
                      </>
                    )}
                  </div>
                  <div className="h-1 bg-line/30 rounded-full mt-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${c.priority_pct}%`, background: "linear-gradient(90deg, #0c5c63, #7accc9)" }}
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel >
  );
}
