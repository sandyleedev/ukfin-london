import { motion } from "framer-motion";
import { ArrowRight, ArrowDown } from "lucide-react";
import reguLensLogo from "../../ReguLensLogo.png";

// Minimal but rich: a calm, whitespace-heavy single-scroll story —
// hero → philosophy → capabilities → metrics → partners → CTA.
// Sections reveal on scroll; partner wordmarks drift in a marquee.

const reveal = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] } },
};

function Reveal({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      variants={reveal}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const CAPABILITIES = [
  { n: "01", t: "Cluster the noise", d: "Every complaint in the corpus is grouped into recurring harm patterns — no manual tagging." },
  { n: "02", t: "Score what matters", d: "Frequency, severity, growth and regulatory relevance combine into one transparent priority." },
  { n: "03", t: "Act on the evidence", d: "Drill from a spike to the individual cases and draft a supervisory action in a click." },
];

const STATS = [
  { v: "130K+", l: "complaints analysed" },
  { v: "44", l: "harm clusters surfaced" },
  { v: "4", l: "scoring dimensions" },
  { v: "<1s", l: "to drill any spike" },
];

const PARTNERS = ["Acme Retail Bank", "Sample Assurance Co.", "Examplar Capital", "Demo Payments", "Placeholder Trust", "Northgate Mutual"];

export default function LandingMinimal({ onLaunch }) {
  return (
    <div className="min-h-screen w-full bg-white text-ink font-sans overflow-x-hidden">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 border-b border-line/20">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 h-18 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl border border-line/40 flex items-center justify-center p-1.5 bg-[#f2faf9]">
              <img src={reguLensLogo} alt="ReguLens" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-lg font-heading tracking-tight">ReguLens</span>
          </div>
          <button onClick={onLaunch} className="text-sm font-semibold text-brand hover:text-brand-dark transition-colors flex items-center gap-1.5 group">
            Enter <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 sm:px-10 min-h-[88vh] flex flex-col justify-center">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="h-px w-12 bg-brand mb-8" />
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold font-heading tracking-tight leading-[1.06]">
            A clearer lens on<br /><span className="text-gradient">consumer-finance harm.</span>
          </h1>
          <p className="text-lg text-muted mt-7 max-w-xl leading-relaxed">
            ReguLens reads the entire complaints corpus, clusters recurring harm,
            and ranks what a supervision team should act on first.
          </p>
          <button
            onClick={onLaunch}
            className="group mt-10 inline-flex items-center gap-2.5 text-base font-semibold text-white bg-gradient-to-r from-[#0c5c63] to-[#7accc9] hover:from-[#073a3f] hover:to-[#0c5c63] rounded-2xl px-7 py-3.5 transition-all shadow-md"
          >
            Enter the dashboard
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
        <div className="mt-20 flex items-center gap-2 text-xs text-muted/50 animate-bounce">
          <ArrowDown className="w-4 h-4" /> scroll
        </div>
      </section>

      {/* Philosophy */}
      <section className="bg-[#f2faf9] border-y border-line/20">
        <div className="max-w-4xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.25em] text-brand font-semibold mb-6">Our belief</p>
            <p className="text-2xl sm:text-4xl font-heading font-semibold leading-snug tracking-tight">
              Consumer harm is visible <span className="text-gradient">long before it becomes systemic</span> —
              if you know where to look.
            </p>
            <p className="text-base text-muted mt-8 max-w-2xl leading-relaxed">
              Supervision teams are drowning in complaints, not insight. ReguLens flips that: it does the reading,
              the grouping and the ranking, so scarce expert attention lands on the patterns that actually matter —
              earlier, and with the evidence already attached.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Capabilities */}
      <section className="max-w-5xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.25em] text-brand font-semibold mb-12">How it works</p>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {CAPABILITIES.map((c, i) => (
            <Reveal key={c.n} delay={i * 0.12}>
              <div className="border-t-2 border-line/40 pt-5">
                <span className="text-sm font-mono text-brand">{c.n}</span>
                <h3 className="text-xl font-semibold font-heading mt-2 mb-2.5">{c.t}</h3>
                <p className="text-sm text-muted leading-relaxed">{c.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Metrics band */}
      <section className="bg-ink text-white">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-16 grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6">
          {STATS.map((s, i) => (
            <Reveal key={s.l} delay={i * 0.1}>
              <div>
                <div className="text-3xl sm:text-4xl font-bold font-heading text-gradient">{s.v}</div>
                <div className="text-xs sm:text-sm text-white/50 mt-1.5">{s.l}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Partners marquee */}
      <section className="py-20 sm:py-24 border-b border-line/20">
        <Reveal className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-muted/60 font-semibold">Built for teams like</p>
        </Reveal>
        <div className="marquee-mask overflow-hidden">
          <div className="flex w-max animate-marquee">
            {[...PARTNERS, ...PARTNERS].map((n, i) => (
              <span key={i} className="mx-8 text-lg sm:text-xl font-semibold font-heading text-muted/50 whitespace-nowrap">
                {n}
              </span>
            ))}
          </div>
        </div>
        <p className="text-center text-[11px] text-muted/40 mt-10">Demo — partner names are fictional &amp; illustrative only.</p>
      </section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-6 sm:px-10 py-28 sm:py-36 text-center">
        <Reveal>
          <h2 className="text-3xl sm:text-5xl font-extrabold font-heading tracking-tight leading-tight">
            See what to act on first.
          </h2>
          <button
            onClick={onLaunch}
            className="group mt-10 inline-flex items-center gap-2.5 text-base font-semibold text-white bg-gradient-to-r from-[#0c5c63] to-[#7accc9] hover:from-[#073a3f] hover:to-[#0c5c63] rounded-2xl px-8 py-4 transition-all shadow-md"
          >
            Enter the dashboard
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </Reveal>
      </section>

      <footer className="px-6 sm:px-10 py-8 text-xs text-muted/60 border-t border-line/20 text-center">
        © {new Date().getFullYear()} ReguLens — a new lens to view financial regulation. Demo environment.
      </footer>
    </div>
  );
}
