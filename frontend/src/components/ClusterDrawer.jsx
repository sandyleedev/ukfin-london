import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FileSearch } from "lucide-react";
import { SeverityBadge, StatusBadge, GrowthPill, fmtTime } from "../ui.jsx";
import Assessment from "./Assessment.jsx";

export default function ClusterDrawer({ cluster, onClose }) {
  const navigate = useNavigate();
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

          <button
            onClick={() => navigate(`/cases?cluster_id=${encodeURIComponent(cluster.id)}`)}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-[#0c5c63] to-[#7accc9] hover:from-[#073a3f] hover:to-[#0c5c63] rounded-xl py-3 transition-all"
          >
            <FileSearch className="w-4 h-4" strokeWidth={2} />
            View {cluster.cases.toLocaleString()} individual cases
          </button>

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
