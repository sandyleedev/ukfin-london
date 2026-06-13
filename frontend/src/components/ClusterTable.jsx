import { Panel, SeverityBadge, StatusBadge, GrowthPill, fmtTime } from "../ui.jsx";

// Full "Identified Clusters" table (bottom of the reference layout).
export default function ClusterTable({ clusters, selectedId, onSelect }) {
  const cols = ["Cluster Name", "Category", "Cases", "7d Growth", "Severity", "Status", "Last Activity"];
  return (
    <Panel title="Identified Clusters" subtitle={`${clusters.length} active`} className="h-full">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-card">
          <tr className="text-[10px] uppercase tracking-wide text-muted">
            {cols.map((c) => (
              <th key={c} className="font-semibold px-4 py-2 border-b border-line whitespace-nowrap">{c}</th>
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
                className={`text-xs cursor-pointer border-b border-line ${active ? "bg-accent/10" : "hover:bg-bg"}`}
              >
                <td className="px-4 py-2.5 max-w-[280px]">
                  <div className="font-medium text-ink truncate">{c.name}</div>
                  {c.companies?.length > 0 && (
                    <div className="text-[10px] text-muted truncate">{c.companies.join(", ")}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-accent-dark font-medium whitespace-nowrap">{c.category}</td>
                <td className="px-4 py-2.5 font-mono">{c.cases.toLocaleString()}</td>
                <td className="px-4 py-2.5"><GrowthPill value={c.growth_7d} /></td>
                <td className="px-4 py-2.5"><SeverityBadge band={c.severity_band} /></td>
                <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-2.5 text-muted whitespace-nowrap">{fmtTime(c.last_activity)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
