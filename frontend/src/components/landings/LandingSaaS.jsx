import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Activity, Layers, Zap, BarChart3, Lock } from "lucide-react";
import reguLensLogo from "../../ReguLensLogo.png";

// B2B SaaS product-landing variant: top nav, value-prop hero, product
// preview, feature grid, metrics and a trust strip. Reads like a real
// commercial supervision tool you'd sell to a compliance team.
export default function LandingSaaS({ onLaunch }) {
  const features = [
    { Icon: Layers, title: "Cluster the noise", desc: "Millions of complaints grouped into recurring harm patterns automatically." },
    { Icon: Activity, title: "Catch escalation early", desc: "Severity, growth and regulatory-relevance scoring surfaces risk before it spreads." },
    { Icon: BarChart3, title: "Drill into the truth", desc: "Trace any spike down to the individual cases and the firms driving it." },
    { Icon: Zap, title: "Act in one click", desc: "Draft and log supervisory actions straight from the evidence." },
  ];
  const metrics = [
    { v: "130K+", l: "complaints analysed" },
    { v: "44", l: "harm clusters surfaced" },
    { v: "<1s", l: "to drill any spike" },
    { v: "4", l: "scoring dimensions" },
  ];

  return (
    <div className="min-h-screen w-full bg-[#f2faf9] text-ink font-sans overflow-x-hidden">
      {/* Top nav */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#f2faf9]/80 border-b border-line/30">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl glass border border-line/40 flex items-center justify-center p-1.5 bg-white/70">
              <img src={reguLensLogo} alt="ReguLens" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-lg font-heading tracking-tight">ReguLens</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden sm:inline text-xs text-muted">Supervision intelligence platform</span>
            <button onClick={onLaunch} className="text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-4 py-2 rounded-xl transition-colors">
              Launch
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-12 text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand/10 border border-brand/20 rounded-full px-3 py-1 mb-6">
            <ShieldCheck className="w-3.5 h-3.5" /> Built for conduct supervision
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold font-heading tracking-tight leading-[1.05] max-w-3xl mx-auto">
            See consumer harm <span className="text-gradient">before it becomes systemic</span>.
          </h1>
          <p className="text-base sm:text-lg text-muted mt-6 max-w-2xl mx-auto leading-relaxed">
            ReguLens turns the raw complaints firehose into a ranked queue of emerging harm patterns —
            so supervision teams know exactly what to look at first.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
            <button onClick={onLaunch} className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-[#0c5c63] to-[#7accc9] hover:from-[#073a3f] hover:to-[#0c5c63] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md">
              Enter dashboard <ArrowRight className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Demo data · no login required</span>
          </div>
        </motion.div>

        {/* Product preview mock */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-14 sm:mt-20 glass border border-line/40 rounded-3xl p-3 sm:p-4 shadow-[0_24px_80px_rgba(12,92,99,0.12)] max-w-4xl mx-auto"
        >
          <div className="rounded-2xl bg-white/80 border border-line/30 overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-line/20">
              <span className="w-2.5 h-2.5 rounded-full bg-critical/40" />
              <span className="w-2.5 h-2.5 rounded-full bg-high/40" />
              <span className="w-2.5 h-2.5 rounded-full bg-low/40" />
              <span className="ml-3 text-[11px] font-mono text-muted">regulens / overview</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {metrics.map((m) => (
                <div key={m.l} className="text-left bg-accent/30 border border-line/20 rounded-xl p-3">
                  <div className="text-xl sm:text-2xl font-bold font-heading text-ink">{m.v}</div>
                  <div className="text-[11px] text-muted mt-0.5">{m.l}</div>
                </div>
              ))}
            </div>
            <div className="px-4 pb-4 flex items-end gap-1.5 h-24">
              {[40, 65, 30, 80, 55, 95, 48, 70, 35, 60, 88, 50].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-brand/30 to-brand/60" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ Icon, title, desc }) => (
            <div key={title} className="glass border border-line/30 rounded-2xl p-6 bg-white/50 hover:bg-white/90 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-brand/10 border border-brand/15 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-brand" />
              </div>
              <h3 className="font-semibold font-heading text-ink mb-1.5">{title}</h3>
              <p className="text-sm text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-20 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted/60 mb-4">Designed for supervision &amp; compliance teams</p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 opacity-60 text-sm font-semibold font-heading text-muted">
          {["Acme Retail Bank", "Sample Assurance Co.", "Examplar Capital", "Demo Payments", "Placeholder Trust"].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <p className="text-[11px] text-muted/40 mt-4">Demo — partner names are fictional &amp; illustrative only.</p>
      </section>
    </div>
  );
}
