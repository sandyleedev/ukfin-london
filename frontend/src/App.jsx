import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchDashboard } from "./api.js";
import { SeverityBadge, StatusBadge, GrowthPill, fmtTime } from "./ui.jsx";
import Header from "./components/Header.jsx";
import KpiStrip from "./components/KpiStrip.jsx";
import ClusterRankings from "./components/ClusterRankings.jsx";
import LiveAlerts from "./components/LiveAlerts.jsx";
import TrendChart from "./components/TrendChart.jsx";
import ClusterTable from "./components/ClusterTable.jsx";
import Assessment from "./components/Assessment.jsx";
import LandingPage from "./components/LandingPage.jsx";

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    fetchDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8 animate-fade-in">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <div className="text-critical font-semibold mb-3 text-base">Could not load dashboard</div>
          <p className="text-sm text-muted">{error}</p>
          <p className="text-xs text-muted mt-4">
            From <code className="text-brand">backend/</code>: <code className="text-brand">python build_dashboard.py</code> then <code className="text-brand">uvicorn api:app --reload</code>
          </p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted gap-3">
        <div className="w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
        <span className="text-sm">Loading supervision intelligence…</span>
      </div>
    );
  }

  const selected = data.clusters.find((c) => c.id === selectedId) || null;

  return (
    <AnimatePresence mode="wait">
      {!started ? (
        <motion.div key="landing" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.4 }}>
          <LandingPage onLaunch={() => setStarted(true)} />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full flex flex-col bg-bg text-ink font-sans"
        >
          <Header generatedAt={data.generated_at} adjudicator={data.adjudicator} onOverview={() => setStarted(false)} />

          <main className="flex-1 overflow-auto no-scrollbar p-6 space-y-6 animate-fade-in">
            <KpiStrip kpis={data.kpis} />

            {/* Row 1: Alerts & Cluster Rankings side-by-side */}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-6 animate-fade-in" style={{ height: "560px" }}>
                <ClusterRankings clusters={data.clusters} selectedId={selectedId} onSelect={setSelectedId} />
              </div>
              <div className="col-span-12 lg:col-span-6 animate-fade-in" style={{ height: "560px" }}>
                <LiveAlerts alerts={data.alerts} />
              </div>
            </div>

            {/* Row 2: Alert Volume Trend (occupies full row, above ClusterTable) */}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 animate-fade-in" style={{ height: "400px" }}>
                <TrendChart trend={data.trend} />
              </div>
            </div>

            {/* Row 3: Identified Clusters (occupies full row) */}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 min-h-0 animate-fade-in">
                <ClusterTable clusters={data.clusters} selectedId={selectedId} onSelect={setSelectedId} />
              </div>
            </div>

            <footer className="text-xs text-muted text-center pt-4 pb-6 font-medium">
              Source: {data.data_source} · adjudicator: {data.adjudicator} · generated {fmtTime(data.generated_at)} ·
              weights {Object.entries(data.weights).map(([k, v]) => `${k} ${v}`).join(" / ")}
            </footer>
          </main>

          {/* Detail drawer */}
          {selected && <ClusterDrawer cluster={selected} onClose={() => setSelectedId(null)} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ClusterDrawer({ cluster, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-md" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative w-full max-w-4xl max-h-[90vh] bg-white border border-line/40 rounded-3xl shadow-[0_16px_64px_rgba(180,205,230,0.3)] overflow-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 py-6 border-b border-line/30 flex items-start justify-between sticky top-0 bg-white/95 backdrop-blur-xl z-10 rounded-t-3xl">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <SeverityBadge band={cluster.severity_band} />
              <StatusBadge status={cluster.status} />
              <span className="text-xs text-muted font-mono">{cluster.id}</span>
            </div>
            <h3 className="text-xl font-semibold text-ink leading-snug font-heading">{cluster.name}</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink text-2xl leading-none p-2 hover:bg-accent rounded-xl transition-colors">×</button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Metric label="Category" value={cluster.category} />
            <Metric label="Cases" value={cluster.cases.toLocaleString()} />
            <Metric label="7-day growth" value={<GrowthPill value={cluster.growth_7d} />} />
            <Metric label="Priority" value={`${cluster.priority_pct}% (rank ${cluster.rank})`} />
            <Metric label="Reg. relevance" value={cluster.regulatory_relevance} />
            <Metric label="First seen" value={fmtTime(cluster.first_seen)} />
            <Metric label="Last activity" value={fmtTime(cluster.last_activity)} />
          </div>

          {cluster.companies?.length > 0 && (
            <Section title="Firms involved">
              <div className="flex flex-wrap gap-2">
                {cluster.companies.map((c) => (
                  <span key={c} className="text-xs bg-accent/50 border border-line/30 rounded-lg px-3 py-1.5 text-muted">{c}</span>
                ))}
              </div>
            </Section>
          )}

          {(cluster.matched_keywords?.length > 0 || cluster.matched_signals?.length > 0) && (
            <Section title="Detection signals">
              <div className="flex flex-wrap gap-2">
                {cluster.matched_keywords?.map((k) => (
                  <span key={k} className="text-xs bg-brand/5 text-brand border border-brand/15 rounded-lg px-3 py-1.5">{k}</span>
                ))}
                {cluster.matched_signals?.map((s) => (
                  <span key={s} className="text-xs bg-high/5 text-high border border-high/15 rounded-lg px-3 py-1.5">{s}</span>
                ))}
              </div>
            </Section>
          )}

          <Assessment assessment={cluster.assessment} />

          {cluster.sample_narratives?.length > 0 && (
            <Section title="Sample complaints">
              <ul className="space-y-2.5">
                {cluster.sample_narratives.map((n, i) => (
                  <li key={i} className="text-sm text-muted leading-relaxed glass-subtle rounded-xl p-4 hover:text-ink transition-colors duration-300">
                    "{n}{n.length >= 2000 ? "…" : ""}"
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="glass-subtle p-3.5">
      <div className="text-xs uppercase tracking-wider text-muted mb-1">{label}</div>
      <div className="text-sm font-medium text-ink">{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-sm font-semibold text-ink mb-2.5">{title}</div>
      {children}
    </div>
  );
}
