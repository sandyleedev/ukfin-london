import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Bell, Gauge, ListOrdered } from "lucide-react";
import { fetchMethodology } from "../api.js";
import { SEVERITY_HEX } from "../ui.jsx";

// Item 4 — transparent reference for *why* an alert fires and how severity /
// priority are computed. Sourced live from the backend, which derives it from
// the scoring engine's own constants (single source of truth).
export default function MethodologyModal({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchMethodology()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-md" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-2xl max-h-[92vh] bg-white border border-line/40 rounded-2xl sm:rounded-3xl shadow-[0_16px_64px_rgba(180,205,230,0.3)] overflow-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-line/30 flex items-start justify-between sticky top-0 bg-white/95 backdrop-blur-xl z-10 rounded-t-2xl sm:rounded-t-3xl">
          <div>
            <div className="flex items-center gap-2 text-brand mb-1">
              <Bell className="w-4 h-4" strokeWidth={2} />
              <span className="text-xs font-bold uppercase tracking-wider">Alert methodology</span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-ink font-heading">Why these alerts? The thresholds &amp; formulas</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink text-2xl leading-none p-2 hover:bg-accent rounded-xl transition-colors flex-shrink-0">×</button>
        </div>

        <div className="p-5 sm:p-7 space-y-6">
          {error && <p className="text-sm text-critical">{error}</p>}
          {!data && !error && (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand" /></div>
          )}

          {data && (
            <>
              <section>
                <SectionTitle Icon={Bell} title="Alert triggers" />
                <p className="text-xs text-muted mb-3">
                  A cluster needs at least <span className="font-semibold text-ink">{data.min_alert_cases}</span> cases
                  before it can raise a spike/escalation/triage alert, so a single brand-new complaint can't masquerade as critical.
                </p>
                <div className="space-y-2">
                  {data.alert_types.map((a) => (
                    <div key={a.type} className="glass-subtle p-3.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-bold tracking-wider uppercase text-ink">{a.type}</span>
                        <span className="text-[10px] font-mono text-muted">{a.severity}</span>
                      </div>
                      <p className="text-xs text-brand font-mono mb-1">{a.trigger}</p>
                      <p className="text-sm text-muted leading-relaxed">{a.meaning}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <SectionTitle Icon={Gauge} title="Severity score" />
                <code className="block text-xs sm:text-sm font-mono text-ink bg-accent/30 border border-line/30 rounded-lg p-3 leading-relaxed overflow-x-auto">
                  {data.severity.formula}
                </code>
                <ul className="mt-2 space-y-1">
                  {Object.entries(data.severity.detail).map(([k, v]) => (
                    <li key={k} className="text-xs text-muted">
                      <span className="font-mono text-brand">{k}</span> — {v}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 mt-3">
                  {data.severity.bands.map((b) => (
                    <span key={b.band} className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
                      style={{ color: SEVERITY_HEX[b.band] || "#61758a", borderColor: `${SEVERITY_HEX[b.band] || "#61758a"}30`, background: `${SEVERITY_HEX[b.band] || "#61758a"}08` }}>
                      {b.band} ≥ {b.min_score}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <SectionTitle Icon={ListOrdered} title="Priority score" />
                <code className="block text-xs sm:text-sm font-mono text-ink bg-accent/30 border border-line/30 rounded-lg p-3 leading-relaxed overflow-x-auto">
                  {data.priority.formula}
                </code>
                <p className="text-xs text-muted mt-2">{data.priority.note}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {Object.entries(data.priority.default_weights).map(([k, v]) => (
                    <span key={k} className="text-xs font-mono bg-brand/5 text-brand border border-brand/20 rounded-md px-2.5 py-1">
                      {k} {v}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-muted/70 mt-2">Weights are tunable on the Scoring page.</p>
              </section>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SectionTitle({ Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <Icon className="w-4 h-4 text-brand" strokeWidth={2} />
      <span className="text-sm font-bold uppercase tracking-wider text-ink">{title}</span>
    </div>
  );
}
