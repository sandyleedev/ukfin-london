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
      <div className="h-full flex items-center justify-center p-6 animate-fade-in">
        <div className="glass-panel rounded-xl p-6 max-w-md text-center">
          <div className="text-critical font-semibold mb-2">Could not load dashboard</div>
          <p className="text-sm text-muted">{error}</p>
          <p className="text-xs text-muted mt-3">From <code>backend/</code>: <code>python build_dashboard.py</code> then <code>uvicorn api:app --reload</code></p>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="h-full flex items-center justify-center text-muted text-sm">Loading supervision intelligence…</div>;
  }

  const selected = data.clusters.find((c) => c.id === selectedId) || null;

  return (
    <AnimatePresence mode="wait">
      {!started ? (
        <motion.div key="landing" exit={{ opacity: 0, y: -50 }} transition={{ duration: 0.5 }}>
          <LandingPage onLaunch={() => setStarted(true)} />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full flex flex-col bg-bg text-ink font-sans selection:bg-brand selection:text-white"
        >
          <Header generatedAt={data.generated_at} adjudicator={data.adjudicator} onOverview={() => setStarted(false)} />

          <main className="flex-1 overflow-auto no-scrollbar p-4 space-y-4 animate-fade-in">
            <KpiStrip kpis={data.kpis} />

            {/* Top grid: rankings (left) + alerts & trend (right) */}
            <div className="grid grid-cols-12 gap-4" style={{ height: "440px" }}>
              <div className="col-span-5 min-h-0">
                <ClusterRankings clusters={data.clusters} selectedId={selectedId} onSelect={setSelectedId} />
              </div>
              <div className="col-span-7 grid grid-rows-2 gap-4 min-h-0">
                <LiveAlerts alerts={data.alerts} />
                <TrendChart trend={data.trend} />
              </div>
            </div>

            {/* Full cluster table */}
            <div style={{ minHeight: "260px" }}>
              <ClusterTable clusters={data.clusters} selectedId={selectedId} onSelect={setSelectedId} />
            </div>

            <footer className="text-[11px] text-muted text-center pt-1 pb-2">
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
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-brand/10 backdrop-blur-sm" />
      <div
        className="relative w-[440px] max-w-[90vw] h-full bg-card border-l border-line shadow-[0_0_40px_rgba(0,0,0,0.1)] overflow-auto no-scrollbar animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-line flex items-start justify-between sticky top-0 bg-card z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge band={cluster.severity_band} />
              <StatusBadge status={cluster.status} />
              <span className="text-[10px] text-muted font-mono">{cluster.id}</span>
            </div>
            <h3 className="text-sm font-semibold text-ink leading-snug">{cluster.name}</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Category" value={cluster.category} />
            <Metric label="Cases" value={cluster.cases.toLocaleString()} />
            <Metric label="7-day growth" value={<GrowthPill value={cluster.growth_7d} />} />
            <Metric label="AI confidence" value={`${cluster.ai_confidence}%`} />
            <Metric label="Priority" value={`${cluster.priority_pct}% (rank ${cluster.rank})`} />
            <Metric label="Reg. relevance" value={cluster.regulatory_relevance} />
            <Metric label="First seen" value={fmtTime(cluster.first_seen)} />
            <Metric label="Last activity" value={fmtTime(cluster.last_activity)} />
          </div>

          {cluster.companies?.length > 0 && (
            <Section title="Firms involved">
              <div className="flex flex-wrap gap-1.5">
                {cluster.companies.map((c) => (
                  <span key={c} className="text-[11px] bg-bg border border-line rounded px-2 py-0.5">{c}</span>
                ))}
              </div>
            </Section>
          )}

          {(cluster.matched_keywords?.length > 0 || cluster.matched_signals?.length > 0) && (
            <Section title="Detection signals">
              <div className="flex flex-wrap gap-1.5">
                {cluster.matched_keywords?.map((k) => (
                  <span key={k} className="text-[10px] bg-accent/10 text-accent-dark border border-accent/30 rounded px-1.5 py-0.5">{k}</span>
                ))}
                {cluster.matched_signals?.map((s) => (
                  <span key={s} className="text-[10px] bg-high/10 text-high border border-high/30 rounded px-1.5 py-0.5">{s}</span>
                ))}
              </div>
            </Section>
          )}

          {/* The supervisory dossier — why concerning, why AI, Consumer Duty,
              mechanism hypotheses, and recommended regulator actions. */}
          <Assessment assessment={cluster.assessment} />

          {cluster.sample_narratives?.length > 0 && (
            <Section title="Sample complaints">
              <ul className="space-y-2">
                {cluster.sample_narratives.map((n, i) => (
                  <li key={i} className="text-xs text-muted leading-relaxed bg-bg border border-line rounded-lg p-4 hover:text-ink transition-colors duration-300">
                    “{n}…”
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm font-medium text-ink">{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-ink mb-1.5">{title}</div>
      {children}
    </div>
  );
}
