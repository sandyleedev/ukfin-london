import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDashboard } from "../DataContext.jsx";
import ClusterTable from "../components/ClusterTable.jsx";
import ClusterDrawer from "../components/ClusterDrawer.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";

export default function Clusters() {
  const { data } = useDashboard();
  const [params] = useSearchParams();

  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(params.get("category") || "ALL");
  const [selectedSeverity, setSelectedSeverity] = useState(params.get("severity") || "ALL");
  const [selectedStatus, setSelectedStatus] = useState(params.get("status") || "ALL");

  const selected = data.clusters.find((c) => c.id === selectedId) || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-ink">Identified Clusters</h1>
        <p className="text-sm text-muted mt-1">
          Recurring harm patterns discovered across the complaint corpus. Click a row to inspect, then drill into individual cases.
        </p>
      </div>

      <div style={{ height: "calc(100vh - 220px)" }}>
        <ErrorBoundary>
          <ClusterTable
            clusters={data.clusters}
            selectedId={selectedId}
            onSelect={setSelectedId}
            search={search}
            setSearch={setSearch}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedSeverity={selectedSeverity}
            setSelectedSeverity={setSelectedSeverity}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
          />
        </ErrorBoundary>
      </div>

      {selected && <ClusterDrawer cluster={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
