import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../DataContext.jsx";
import KpiStrip from "../components/KpiStrip.jsx";
import ClusterRankings from "../components/ClusterRankings.jsx";
import LiveAlerts from "../components/LiveAlerts.jsx";
import TrendChart from "../components/TrendChart.jsx";
import ClusterDrawer from "../components/ClusterDrawer.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import { fmtTime } from "../ui.jsx";

export default function Overview() {
  const { data } = useDashboard();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(null);

  const handleKpiClick = (type) => {
    const map = {
      critical: "/clusters?severity=CRITICAL",
      escalating: "/clusters?status=ESCALATING",
      active: "/clusters",
      cases: "/cases",
    };
    if (map[type]) navigate(map[type]);
  };

  const selected = data.clusters.find((c) => c.id === selectedId) || null;

  return (
    <div className="space-y-6">
      <ErrorBoundary>
        <KpiStrip kpis={data.kpis} onKpiClick={handleKpiClick} />
      </ErrorBoundary>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-6" style={{ height: "560px" }}>
          <ErrorBoundary>
            <ClusterRankings clusters={data.clusters} selectedId={selectedId} onSelect={setSelectedId} />
          </ErrorBoundary>
        </div>
        <div className="col-span-12 lg:col-span-6" style={{ height: "560px" }}>
          <ErrorBoundary>
            <LiveAlerts alerts={data.alerts} />
          </ErrorBoundary>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12" style={{ height: "400px" }}>
          <ErrorBoundary>
            <TrendChart trend={data.trend} />
          </ErrorBoundary>
        </div>
      </div>

      <footer className="text-xs text-muted text-center pt-4 pb-6 font-medium">
        Source: {data.data_source} · adjudicator: {data.adjudicator} · generated {fmtTime(data.generated_at)} ·
        weights {Object.entries(data.weights).map(([k, v]) => `${k} ${v}`).join(" / ")}
      </footer>

      {selected && <ClusterDrawer cluster={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
