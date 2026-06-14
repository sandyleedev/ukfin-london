import { Panel, SeverityBadge, GrowthPill } from "../ui.jsx";

// Prioritised list of harm clusters (left column of the reference layout).
// Sorted by the backend's weighted priority score; the bar shows priority_pct.
export default function ClusterRankings({ clusters, selectedId, onSelect }) {
  return (
    <Panel
      title="Complaint Cluster Rankings"
      subtitle="ranked by weighted priority · freq × severity × growth × reg-relevance"
      className="h-full"
    >
      <ul className="divide-y divide-line">
        {clusters.map((c) => {
          const active = c.id === selectedId;
          return (
            <li
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`px-4 py-3 cursor-pointer transition-colors ${active ? "bg-accent/10" : "hover:bg-bg"}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-lg font-bold text-muted w-6 flex-shrink-0 text-center">{c.rank}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <GrowthPill value={c.growth_7d} />
                    <span className="text-[10px] text-muted">/ 7 days</span>
                    <SeverityBadge band={c.severity_band} />
                  </div>
                  <p className="text-sm font-semibold text-ink mt-0.5 leading-snug truncate">{c.name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted mt-1">
                    <span className="font-medium text-accent-dark">{c.category}</span>
                    <span>·</span>
                    <span>{c.cases.toLocaleString()} cases</span>
                    {c.companies?.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="truncate">{c.companies.slice(0, 2).join(", ")}
                          {c.companies.length > 2 && ` +${c.companies.length - 2}`}</span>
                      </>
                    )}
                  </div>
                  {/* priority bar */}
                  <div className="h-1 bg-line rounded-full mt-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${c.priority_pct}%`, background: "#4fc3dc" }} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
