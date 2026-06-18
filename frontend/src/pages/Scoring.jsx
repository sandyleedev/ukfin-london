import { useEffect, useMemo, useState } from "react";
import { Lock, Unlock, RotateCcw, ArrowUp, ArrowDown, Minus, Info, Cpu, Check, Save, ChevronDown } from "lucide-react";
import { useDashboard } from "../DataContext.jsx";
import { rescore, fetchProviders, setAnalysisEngine, fetchWeights, saveWeights, resetWeights, fetchConfig, saveConfig, resetConfig } from "../api.js";
import { Panel, SeverityBadge } from "../ui.jsx";

// Editable per-category regulatory-relevance priors (CRUD → /api/config),
// applied live across the dashboard. Authorised supervisors only.
function RelevanceEditor({ authed }) {
  const [map, setMap] = useState(null);
  const [isCustom, setIsCustom] = useState(false);
  const [open, setOpen] = useState(false);
  const [saveState, setSaveState] = useState("idle");

  useEffect(() => {
    fetchConfig().then((r) => { setMap(r.reg_relevance); setIsCustom(r.is_custom); }).catch(() => {});
  }, []);

  if (!map) return null;
  const cats = Object.keys(map).sort();

  const set = (k, v) => setMap((m) => ({ ...m, [k]: v }));
  const persist = () => {
    setSaveState("saving");
    saveConfig(map).then((r) => { setMap(r.reg_relevance); setIsCustom(r.is_custom); setSaveState("saved"); setTimeout(() => setSaveState("idle"), 1800); }).catch(() => setSaveState("idle"));
  };
  const reset = () => resetConfig().then((r) => { setMap(r.reg_relevance); setIsCustom(false); }).catch(() => {});

  return (
    <div className={`glass rounded-2xl p-5 ${!authed ? "opacity-60" : ""}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between">
        <span className="text-sm font-semibold text-ink flex items-center gap-2">
          Category relevance priors
          {isCustom && <span className="text-[10px] font-bold uppercase tracking-wider bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded">custom</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <p className="text-xs text-muted mt-1">How central each category is to the FCA remit (0–1). Feeds the priority score.</p>
      {open && (
        <div className="mt-3 space-y-2.5">
          {cats.map((k) => (
            <div key={k}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-ink">{k}</span>
                <span className="font-mono font-semibold text-brand">{Number(map[k]).toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={map[k]} disabled={!authed}
                onChange={(e) => set(k, parseFloat(e.target.value))}
                className="w-full accent-brand cursor-pointer disabled:cursor-not-allowed" />
            </div>
          ))}
          {authed && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={reset} className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink px-3 py-1.5 rounded-lg hover:bg-accent/40 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button onClick={persist} disabled={saveState === "saving"} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-dark px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                {saveState === "saved" ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved — live" : "Save"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ENGINES = [
  { key: "auto", label: "Auto", desc: "Pick the best available provider." },
  { key: "score", label: "Deterministic", desc: "No LLM — rule-based, fully auditable." },
  { key: "claude", label: "Claude", desc: "Anthropic Claude reasoning." },
  { key: "gemini", label: "Gemini", desc: "Google Gemini reasoning." },
];

function AnalysisEngineCard({ onEngineChange }) {
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    fetchProviders().then(setStatus).catch(() => setStatus(null));
  }, []);

  const choose = (engine) => {
    setSaving(engine);
    setAnalysisEngine(engine)
      .then((s) => { setStatus(s); onEngineChange && onEngineChange(); })
      .catch(() => {})
      .finally(() => setSaving(null));
  };

  const selected = status?.selected || "auto";

  return (
    <div className="glass rounded-2xl p-6">
      <div className="text-xs uppercase tracking-wider text-muted mb-1 flex items-center gap-1.5">
        <Cpu className="w-3.5 h-3.5" /> Analysis engine
      </div>
      <p className="text-xs text-muted mb-4">
        Which model powers the <span className="font-semibold text-ink">live</span> AI features —
        the chart drill-down and action drafting. (The prebuilt dashboard's adjudication is set at
        build time via <code className="text-brand">ADJUDICATE_BACKEND</code> and isn't re-run live.)
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ENGINES.map((e) => {
          const avail = e.key === "auto" || status?.providers?.[e.key]?.available;
          const active = selected === e.key;
          return (
            <button
              key={e.key}
              onClick={() => avail && choose(e.key)}
              disabled={!avail || saving}
              className={`text-left p-3 rounded-xl border transition-all ${active
                ? "border-brand bg-brand/5 ring-1 ring-brand/30"
                : avail
                  ? "border-line/40 hover:border-brand/50 hover:bg-accent/30"
                  : "border-line/30 opacity-50 cursor-not-allowed"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-ink">{e.label}</span>
                {active && <Check className="w-3.5 h-3.5 text-brand" />}
              </div>
              <p className="text-[11px] text-muted leading-snug">{e.desc}</p>
              {e.key !== "auto" && (
                <span className={`mt-1.5 inline-block text-[10px] font-mono px-1.5 py-0.5 rounded ${avail ? "text-low bg-low/10" : "text-muted bg-line/20"}`}>
                  {avail ? "key configured" : "no key"}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {status && (
        <p className="text-[11px] text-muted/70 mt-3">
          Resolved engine: <span className="font-mono text-ink">{status.resolved}</span>
          {status.resolved === "score" && " — no LLM key found; live features show data-only output."}
        </p>
      )}
    </div>
  );
}

const DIMENSIONS = [
  { key: "frequency", label: "Frequency", desc: "How many consumers are affected (case volume)." },
  { key: "severity", label: "Severity", desc: "How bad the harm is — distress signals, scale, acceleration." },
  { key: "growth", label: "Growth", desc: "How fast the pattern is accelerating — catch it early." },
  { key: "regulatory_relevance", label: "Regulatory relevance", desc: "How central the harm is to the FCA's conduct remit." },
];

// Demo authorisation gate. In production this would be SSO / RBAC.
const DEMO_PASSCODE = "fca-admin";

export default function Scoring() {
  const { data, refresh } = useDashboard();
  const [weights, setWeights] = useState(data.weights);
  const [ranked, setRanked] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [isCustom, setIsCustom] = useState(false);

  // Load any persisted (customer-tuned) weights so the page reflects what's live.
  useEffect(() => {
    fetchWeights()
      .then((r) => { if (r.weights) { setWeights(r.weights); setIsCustom(!!r.is_custom); } })
      .catch(() => {});
  }, []);

  const baselineRank = useMemo(() => {
    const m = {};
    data.clusters.forEach((c) => { m[c.id] = c.rank; });
    return m;
  }, [data]);

  // Debounced live re-score whenever the weights change.
  useEffect(() => {
    const t = setTimeout(() => {
      rescore(weights).then((r) => setRanked(r.clusters)).catch(() => setRanked(null));
    }, 250);
    return () => clearTimeout(t);
  }, [weights]);

  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  const setWeight = (key, val) => {
    if (!authed) return;
    setWeights((w) => ({ ...w, [key]: val }));
  };

  const unlock = () => {
    if (passcode.trim().toLowerCase() === DEMO_PASSCODE) {
      setAuthed(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const persist = () => {
    setSaveState("saving");
    saveWeights(weights)
      .then((r) => { setIsCustom(!!r.is_custom); setSaveState("saved"); setTimeout(() => setSaveState("idle"), 2000); })
      .catch(() => setSaveState("idle"));
  };

  const reset = () => {
    resetWeights()
      .then((r) => { setWeights(r.weights); setIsCustom(false); })
      .catch(() => setWeights(data.weights));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-ink">Scoring & Priority Weights</h1>
        <p className="text-sm text-muted mt-1">
          The priority ranking is a transparent weighted sum. Authorised supervisors can re-tune the balance and see the queue re-rank live.
        </p>
      </div>

      {/* Formula card */}
      <div className="glass rounded-2xl p-6">
        <div className="text-xs uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> Priority formula
        </div>
        <code className="block text-sm md:text-base font-mono text-ink leading-relaxed">
          priority =
          <span className="text-brand"> {weights.frequency.toFixed(2)}</span>·frequency +
          <span className="text-brand"> {weights.severity.toFixed(2)}</span>·severity +
          <span className="text-brand"> {weights.growth.toFixed(2)}</span>·growth +
          <span className="text-brand"> {weights.regulatory_relevance.toFixed(2)}</span>·reg-relevance
        </code>
        <p className="text-xs text-muted mt-3">
          All dimensions are normalised to [0,1] before weighting, so the weights are directly comparable.
          Weights are normalised to sum to 1 at scoring time — current raw sum: <span className="font-semibold text-ink">{total.toFixed(2)}</span>.
        </p>
      </div>

      <AnalysisEngineCard onEngineChange={() => {
        refresh();
        rescore(weights).then((r) => setRanked(r.clusters)).catch(() => {});
      }} />

      <div className="grid grid-cols-12 gap-6">
        {/* Sliders */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          {/* Permission gate */}
          {!authed ? (
            <div className="glass rounded-2xl p-6 border border-high/30">
              <div className="flex items-center gap-2 text-high font-semibold mb-2">
                <Lock className="w-4 h-4" /> Editing locked
              </div>
              <p className="text-xs text-muted mb-3">
                Re-tuning the supervisory priority model requires authorised access. Enter the regulator passcode to unlock.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && unlock()}
                  placeholder="Regulator passcode"
                  className="flex-1 px-3 py-2 text-sm bg-white/70 border border-line/30 rounded-xl focus:outline-none focus:border-brand/70 focus:ring-1 focus:ring-brand/30"
                />
                <button onClick={unlock} className="px-4 py-2 text-sm font-semibold text-white bg-brand hover:bg-brand-dark rounded-xl transition-colors">
                  Unlock
                </button>
              </div>
              {authError && <p className="text-xs text-critical mt-2">Incorrect passcode.</p>}
              <p className="text-[11px] text-muted/60 mt-2">Demo passcode: <code className="text-brand">{DEMO_PASSCODE}</code></p>
            </div>
          ) : (
            <div className="glass rounded-2xl p-4 border border-low/30 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-low font-semibold text-sm">
                <Unlock className="w-4 h-4" /> Editing unlocked
                {isCustom && <span className="text-[10px] font-bold uppercase tracking-wider bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-md">custom active</span>}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={reset} className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink px-3 py-1.5 rounded-lg hover:bg-accent/40 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to default
                </button>
                <button onClick={persist} disabled={saveState === "saving"} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-dark px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  {saveState === "saved" ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved — live" : "Save as active"}
                </button>
              </div>
            </div>
          )}

          {DIMENSIONS.map(({ key, label, desc }) => (
            <div key={key} className={`glass rounded-2xl p-5 ${!authed ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-ink">{label}</span>
                <span className="text-sm font-mono font-bold text-brand">{weights[key].toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted mb-3">{desc}</p>
              <input
                type="range"
                min="0" max="1" step="0.01"
                value={weights[key]}
                disabled={!authed}
                onChange={(e) => setWeight(key, parseFloat(e.target.value))}
                className="w-full accent-brand cursor-pointer disabled:cursor-not-allowed"
              />
            </div>
          ))}

          <RelevanceEditor authed={authed} />
        </div>

        {/* Live re-ranked queue */}
        <div className="col-span-12 lg:col-span-7 h-[520px] lg:h-[640px]">
          <Panel title="Live priority queue" subtitle="Re-ranked under the current weights · Δ vs default model" className="h-full">
            <table className="w-full min-w-[460px] text-left border-collapse">
              <thead className="sticky top-0 bg-white/90 backdrop-blur-xl z-10">
                <tr className="text-xs uppercase tracking-wider text-muted">
                  <th className="font-semibold px-5 py-3 border-b border-line/30">Rank</th>
                  <th className="font-semibold px-5 py-3 border-b border-line/30">Cluster</th>
                  <th className="font-semibold px-5 py-3 border-b border-line/30">Severity</th>
                  <th className="font-semibold px-5 py-3 border-b border-line/30 text-right">Priority</th>
                </tr>
              </thead>
              <tbody>
                {(ranked || []).map((c) => {
                  const prev = baselineRank[c.id];
                  const delta = prev != null ? prev - c.rank : 0;
                  return (
                    <tr key={c.id} className="text-sm border-b border-line/20 hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-3 font-mono font-bold text-ink">
                        <div className="flex items-center gap-2">
                          #{c.rank}
                          {delta > 0 && <span className="flex items-center text-low text-xs"><ArrowUp className="w-3 h-3" />{delta}</span>}
                          {delta < 0 && <span className="flex items-center text-critical text-xs"><ArrowDown className="w-3 h-3" />{Math.abs(delta)}</span>}
                          {delta === 0 && <Minus className="w-3 h-3 text-muted/40" />}
                        </div>
                      </td>
                      <td className="px-5 py-3 max-w-[280px]">
                        <div className="font-medium text-ink truncate">{c.name}</div>
                        <div className="text-xs text-brand">{c.category}</div>
                      </td>
                      <td className="px-5 py-3"><SeverityBadge band={c.severity_band} /></td>
                      <td className="px-5 py-3 text-right font-mono">
                        <div className="font-semibold text-ink">{c.priority_pct}%</div>
                        <div className="w-20 h-1.5 bg-accent/50 rounded-full overflow-hidden ml-auto mt-1">
                          <div className="h-full bg-brand rounded-full" style={{ width: `${c.priority_pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </div>
  );
}
