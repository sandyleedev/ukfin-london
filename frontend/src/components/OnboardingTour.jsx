import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, X, Compass } from "lucide-react";

// Item 2 — first-run guided tour (desktop only, skippable).
// A lightweight spotlight + tooltip walkthrough. Targets are located by their
// `data-tour="..."` attribute so the tour stays decoupled from component markup.
// Auto-runs once (gated on localStorage + viewport ≥ lg); replayable any time
// via the header "?" button, which dispatches a `regulens:start-tour` event.

const STORAGE_KEY = "regulens_onboarded";
const LG = 1024;

const STEPS = [
  {
    target: null,
    title: "Welcome to ReguLens",
    body: "An early-warning system that mines consumer complaints for AI/automation-driven harm, clusters the patterns, and ranks what a regulator should act on first. Here's a 60-second tour.",
  },
  {
    target: "kpis",
    title: "1 · At-a-glance KPIs",
    body: "Top-line numbers — active clusters, critical patterns, escalating harms and total cases. Click any KPI to jump to the filtered view.",
  },
  {
    target: "clusters",
    title: "2 · Priority harm clusters",
    body: "Discovered harm patterns, ranked by a transparent priority score. Click a cluster to open its supervisory assessment and drill into the cases.",
  },
  {
    target: "alerts",
    title: "3 · Live alerts",
    body: "Spikes, escalations and triage flags as patterns move. Tap \"Why these alerts?\" to see the exact thresholds and formulas behind them.",
  },
  {
    target: "trend",
    title: "4 · Trend — click to investigate",
    body: "Alert volume over time. Click any point on the chart to analyse that day: the real cases that drove it, plus live news correlation.",
  },
  {
    target: "nav",
    title: "5 · Explore deeper",
    body: "Clusters (full sortable table), Cases (every complaint), and Scoring (tune the priority weights and choose the analysis engine).",
  },
];

export default function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const start = useCallback(() => {
    if (location.pathname !== "/overview") navigate("/overview");
    setStep(0);
    setActive(true);
  }, [location.pathname, navigate]);

  // Auto-start once on first visit (desktop only).
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (window.innerWidth < LG) return;
    const t = setTimeout(() => start(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Replay trigger from the header button (any viewport).
  useEffect(() => {
    const handler = () => start();
    window.addEventListener("regulens:start-tour", handler);
    return () => window.removeEventListener("regulens:start-tour", handler);
  }, [start]);

  // Measure the current target.
  const measure = useCallback(() => {
    const sel = STEPS[step]?.target;
    if (!sel) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${sel}"]`);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setRect(el.getBoundingClientRect());
  }, [step]);

  useLayoutEffect(() => {
    if (!active) return;
    measure();
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [active, step, measure]);

  if (!active) return null;

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setActive(false);
  };
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());
  const back = () => setStep(Math.max(0, step - 1));

  const s = STEPS[step];
  const pad = 8;
  const ring = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  // Tooltip placement: below the target if there's room, else above; centered when no target.
  const ttWidth = 360;
  let ttStyle;
  if (ring) {
    const below = ring.top + ring.height + 14;
    const placeBelow = below + 200 < window.innerHeight;
    const top = placeBelow ? below : Math.max(16, ring.top - 14 - 200);
    let left = ring.left + ring.width / 2 - ttWidth / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - ttWidth - 16));
    ttStyle = { top, left, width: ttWidth };
  } else {
    ttStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: ttWidth };
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Spotlight mask: a ring with a giant outer shadow dims everything else. */}
      {ring ? (
        <div
          className="absolute rounded-2xl pointer-events-none transition-all duration-300"
          style={{
            top: ring.top, left: ring.left, width: ring.width, height: ring.height,
            boxShadow: "0 0 0 9999px rgba(15, 30, 35, 0.62)",
            border: "2px solid #78ede7",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-ink/60" />
      )}

      {/* Click-catcher (skip on backdrop click is intentional-free; use Skip btn). */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Tooltip */}
      <div
        className="absolute max-w-[calc(100vw-32px)] bg-white border border-line/50 rounded-2xl shadow-[0_16px_64px_rgba(12,92,99,0.25)] p-5 animate-fade-in"
        style={ttStyle}
      >
        <div className="flex items-center gap-2 text-brand mb-2">
          <Compass className="w-4 h-4" strokeWidth={2} />
          <span className="text-xs font-bold uppercase tracking-wider">Guided tour</span>
          <button onClick={finish} className="ml-auto text-muted hover:text-ink p-1 -mr-1 rounded-md hover:bg-accent/40 transition-colors" title="Skip tour">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h4 className="text-base font-semibold text-ink font-heading mb-1.5">{s.title}</h4>
        <p className="text-sm text-muted leading-relaxed">{s.body}</p>

        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? "bg-brand" : "bg-line/60"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={finish} className="text-xs font-semibold text-muted hover:text-ink px-3 py-1.5 rounded-lg hover:bg-accent/40 transition-colors">
              Skip
            </button>
            {step > 0 && (
              <button onClick={back} className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink px-3 py-1.5 rounded-lg hover:bg-accent/40 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            <button onClick={next} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-dark px-4 py-1.5 rounded-lg transition-colors">
              {step < STEPS.length - 1 ? <>Next <ArrowRight className="w-3.5 h-3.5" /></> : "Finish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
