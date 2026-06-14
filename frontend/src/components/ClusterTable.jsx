import { Panel, SeverityBadge, StatusBadge, GrowthPill, fmtTime } from "../ui.jsx";

// Full "Identified Clusters" table (bottom of the reference layout).
export default function ClusterTable({ clusters, selectedId, onSelect }) {
  const cols = ["Cluster Name", "Category", "Cases", "7d Growth", "Severity", "Status", "AI Conf.", "Last Activity"];
  return (
    <Panel title="Identified Clusters" subtitle={`${clusters.length} active`} className="h-full">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-white/90 backdrop-blur-md shadow-sm z-10">
          <tr className="text-xs uppercase tracking-wide text-muted">
            {cols.map((c) => (
              <th key={c} className="font-semibold px-6 py-4 border-b border-line whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clusters.map((c) => {
            const active = c.id === selectedId;
            return (
              <tr
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`text-sm cursor-pointer border-b border-line transition-colors duration-200 ${active ? "bg-bg border-l-2 border-l-accent" : "hover:bg-bg"}`}
              >
                <td className="px-6 py-4 max-w-[280px]">
                  <div className="font-medium text-ink truncate">{c.name}</div>
                  {c.companies?.length > 0 && (
                    <div className="text-xs text-muted truncate mt-1">{c.companies.join(", ")}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-accent-dark font-medium whitespace-nowrap">{c.category}</td>
                <td className="px-6 py-4 font-mono">{c.cases.toLocaleString()}</td>
                <td className="px-6 py-4"><GrowthPill value={c.growth_7d} /></td>
                <td className="px-6 py-4"><SeverityBadge band={c.severity_band} /></td>
                <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 bg-line rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-brand shadow-[0_0_5px_rgba(108,29,69,0.8)]" style={{ width: `${c.ai_confidence}%` }} />
                    </div>
                    <span className="font-mono text-xs text-muted">{c.ai_confidence}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-muted whitespace-nowrap text-xs">{fmtTime(c.last_activity)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
