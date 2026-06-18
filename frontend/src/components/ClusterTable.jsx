import { useMemo, useState } from "react";
import { Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Panel, SeverityBadge, StatusBadge, GrowthPill, fmtTime } from "../ui.jsx";

export default function ClusterTable({
  clusters,
  selectedId,
  onSelect,
  search,
  setSearch,
  selectedCategory,
  setSelectedCategory,
  selectedSeverity,
  setSelectedSeverity,
  selectedStatus,
  setSelectedStatus,
}) {
  const [sortField, setSortField] = useState("cases"); // Default sort by cases
  const [sortDirection, setSortDirection] = useState("desc");

  const cols = [
    { label: "Cluster Name", field: "name" },
    { label: "Category", field: "category" },
    { label: "Cases", field: "cases" },
    { label: "7d Growth", field: "growth_7d" },
    { label: "Severity", field: "severity" },
    { label: "Status", field: "status" },
    { label: "Last Activity", field: "last_activity" }
  ];

  // Extract all unique categories dynamically
  const categories = useMemo(() => {
    const cats = new Set(clusters.map((c) => c.category).filter(Boolean));
    return ["ALL", ...Array.from(cats)];
  }, [clusters]);

  // Filter clusters
  const filteredClusters = useMemo(() => {
    return (clusters || []).filter((c) => {
      const matchesSearch =
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        (c.companies && c.companies.some((co) => co.toLowerCase().includes(search.toLowerCase())));
      const matchesCategory = selectedCategory === "ALL" || c.category === selectedCategory;
      const matchesSeverity = selectedSeverity === "ALL" || c.severity_band === selectedSeverity;
      const matchesStatus = selectedStatus === "ALL" || c.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesSeverity && matchesStatus;
    });
  }, [clusters, search, selectedCategory, selectedSeverity, selectedStatus]);

  // Sort clusters
  const sortedClusters = useMemo(() => {
    const list = [...filteredClusters];
    const order = sortDirection === "asc" ? 1 : -1;

    list.sort((a, b) => {
      if (sortField === "cases") {
        return (a.cases - b.cases) * order;
      }
      if (sortField === "growth_7d") {
        return (a.growth_7d - b.growth_7d) * order;
      }
      if (sortField === "severity") {
        const severityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        const wA = severityWeight[a.severity_band] || 0;
        const wB = severityWeight[b.severity_band] || 0;
        return (wA - wB) * order;
      }
      if (sortField === "last_activity") {
        const tA = new Date(a.last_activity || 0).getTime();
        const tB = new Date(b.last_activity || 0).getTime();
        return (tA - tB) * order;
      }
      if (sortField === "category") {
        return (a.category || "").localeCompare(b.category || "") * order;
      }
      if (sortField === "name") {
        return (a.name || "").localeCompare(b.name || "") * order;
      }
      return 0;
    });
    return list;
  }, [filteredClusters, sortField, sortDirection]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 opacity-30 group-hover:opacity-60 transition-opacity" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-brand" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-brand" />
    );
  };

  return (
    <Panel
      title="Identified Clusters"
      subtitle={`${sortedClusters.length} matching of ${clusters.length} active`}
      className="h-full"
    >
      {/* Dynamic Filter Strip */}
      <div className="px-6 py-4 border-b border-line/20 bg-white/40 flex items-center justify-between">
        {/* Search bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search clusters or firms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm bg-white/70 border border-line/30 rounded-xl focus:outline-none focus:border-brand/70 focus:ring-1 focus:ring-brand/30 transition-all w-64"
          />
          <span className="absolute left-3 top-2.5 text-muted pointer-events-none">
            <Search className="w-4 h-4 text-muted/60" />
          </span>
        </div>

        {/* Clear Button */}
        {(search || selectedCategory !== "ALL" || selectedSeverity !== "ALL" || selectedStatus !== "ALL") && (
          <button
            onClick={() => {
              setSearch("");
              setSelectedCategory("ALL");
              setSelectedSeverity("ALL");
              setSelectedStatus("ALL");
            }}
            className="text-xs font-semibold text-brand hover:text-brand-dark px-3 py-1.5 bg-brand/5 border border-brand/20 rounded-xl transition-all"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Table */}
      <table className="w-full min-w-[760px] text-left border-collapse">
        <thead className="sticky top-0 bg-white/90 backdrop-blur-xl z-10">
          <tr className="text-xs uppercase tracking-wider text-muted">
            {cols.map((col) => {
              if (col.field === "category") {
                return (
                  <th key={col.label} className="font-semibold px-6 py-4 border-b border-line/30 whitespace-nowrap select-none">
                    <div className="flex items-center gap-1.5 justify-between">

                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-2 px-2 py-1 bg-accent/60 hover:bg-accent border border-line/30 rounded-lg text-xs font-semibold text-muted hover:text-ink cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand/30 transition-all max-w-[130px]"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat === "ALL" ? "All Categories" : cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                );
              }
              if (col.field === "severity") {
                return (
                  <th key={col.label} className="font-semibold px-6 py-4 border-b border-line/30 whitespace-nowrap select-none">
                    <div className="flex items-center gap-1.5 justify-between">

                      <select
                        value={selectedSeverity}
                        onChange={(e) => setSelectedSeverity(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-2 px-2 py-1 bg-accent/60 hover:bg-accent border border-line/30 rounded-lg text-xs font-semibold text-muted hover:text-ink cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand/30 transition-all"
                      >
                        <option value="ALL">All Severity</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                    </div>
                  </th>
                );
              }
              if (col.field === "status") {
                return (
                  <th key={col.label} className="font-semibold px-6 py-4 border-b border-line/30 whitespace-nowrap select-none">
                    <div className="flex items-center gap-1.5 justify-between">
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-2 px-2 py-1 bg-accent/60 hover:bg-accent border border-line/30 rounded-lg text-xs font-semibold text-muted hover:text-ink cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand/30 transition-all"
                      >
                        <option value="ALL">All Status</option>
                        <option value="ESCALATING">Escalating</option>
                        <option value="PERSISTENT">Persistent</option>
                        <option value="SIMMERING">Simmering</option>
                        <option value="STABLE">Stable</option>
                      </select>
                    </div>
                  </th>
                );
              }
              if (!col.field) {
                return (
                  <th key={col.label} className="font-semibold px-6 py-4 border-b border-line/30 whitespace-nowrap">
                    {col.label}
                  </th>
                );
              }
              return (
                <th
                  key={col.label}
                  onClick={() => toggleSort(col.field)}
                  className="font-semibold px-6 py-4 border-b border-line/30 whitespace-nowrap cursor-pointer select-none hover:text-ink hover:bg-accent/35 group transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.label}</span>
                    {renderSortIcon(col.field)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedClusters.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="px-6 py-12 text-center text-muted text-sm">
                No matching clusters found. Try clearing your search or filters.
              </td>
            </tr>
          ) : (
            sortedClusters.map((c) => {
              const active = c.id === selectedId;
              return (
                <tr
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`text-sm cursor-pointer border-b border-line/20 transition-all duration-200 ${active ? "bg-accent border-l-3 border-l-brand" : "hover:bg-accent/40"
                    }`}
                >
                  <td className="px-6 py-4 max-w-[320px]">
                    <div className="font-medium text-ink truncate">{c.name}</div>
                    {c.companies?.length > 0 && (
                      <div className="text-xs text-muted truncate mt-1">{c.companies.join(", ")}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-brand font-medium whitespace-nowrap">{c.category}</td>
                  <td className="px-6 py-4 font-mono">{c.cases.toLocaleString()}</td>
                  <td className="px-6 py-4"><GrowthPill value={c.growth_7d} /></td>
                  <td className="px-6 py-4"><SeverityBadge band={c.severity_band} /></td>
                  <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                  <td className="px-6 py-4 text-muted whitespace-nowrap text-xs">{fmtTime(c.last_activity)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </Panel>
  );
}
