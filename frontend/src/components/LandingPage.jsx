import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import reguLensLogo from "../ReguLensLogo.png";

export default function LandingPage({ onLaunch }) {
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.3 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] },
    },
  };

  // Custom movie/HUD style technical SVG diagrams
  const ClarityDiagram = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10 text-brand transition-transform duration-700 group-hover:rotate-45" stroke="currentColor" fill="none">
      {/* Corner brackets */}
      <path d="M 10 22 L 10 10 L 22 10 M 78 10 L 90 10 L 90 22 M 90 78 L 90 90 L 78 90 M 22 90 L 10 90 L 10 78" strokeWidth="1.5" className="opacity-40" />
      {/* Scattered lines converging */}
      <path d="M 22 35 L 45 50 M 22 50 L 45 50 M 22 65 L 45 50" strokeWidth="2.5" strokeLinecap="round" className="opacity-70" />
      {/* Prism lens */}
      <path d="M 50 18 L 50 82" strokeWidth="4.5" strokeLinecap="round" className="text-accent-dark" />
      {/* Focused straight ray */}
      <path d="M 50 50 L 78 50" strokeWidth="3" strokeLinecap="round" className="text-brand animate-pulse" />
      <circle cx="78" cy="50" r="3" fill="currentColor" />
    </svg>
  );

  const FocusDiagram = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10 text-brand" stroke="currentColor" fill="none">
      {/* Concentric rings */}
      <circle cx="50" cy="50" r="38" strokeWidth="1" strokeDasharray="3 6" className="opacity-40 animate-[spin_40s_linear_infinite]" />
      <circle cx="50" cy="50" r="24" strokeWidth="2" className="text-accent-dark" />
      {/* Corner target reticles */}
      <path d="M 36 36 L 36 43 M 36 36 L 43 36 M 64 36 L 64 43 M 64 36 L 57 36 M 36 64 L 36 57 M 36 64 L 43 64 M 64 64 L 64 57 M 64 64 L 57 64" strokeWidth="2" />
      {/* Center dot */}
      <circle cx="50" cy="50" r="3.5" fill="currentColor" className="animate-ping" />
      <circle cx="50" cy="50" r="3.5" fill="currentColor" />
      {/* Crosshairs lines */}
      <path d="M 50 8 L 50 16 M 50 84 L 50 92 M 8 50 L 16 50 M 84 50 L 92 50" strokeWidth="1.5" className="opacity-80" />
    </svg>
  );

  const InsightDiagram = () => (
    <svg viewBox="0 0 100 100" className="w-10 h-10 text-brand" stroke="currentColor" fill="none">
      {/* Layers of network grids */}
      <path d="M 18 30 L 82 30" strokeWidth="1.5" className="opacity-30" />
      <path d="M 18 50 L 82 50" strokeWidth="1.5" className="opacity-30" />
      <path d="M 18 70 L 82 70" strokeWidth="1.5" className="opacity-30" />
      {/* Laser beam piercing down */}
      <path d="M 50 12 L 50 82" strokeWidth="2.5" strokeLinecap="round" className="text-critical animate-pulse" />
      <polygon points="50,86 45,77 55,77" fill="currentColor" className="text-critical" />
      {/* Nodes connected */}
      <circle cx="32" cy="30" r="3" fill="currentColor" className="text-muted" />
      <circle cx="68" cy="30" r="3" fill="currentColor" className="text-muted" />
      <circle cx="50" cy="50" r="4.5" fill="currentColor" />
      <circle cx="38" cy="70" r="3" fill="currentColor" className="text-muted" />
      <circle cx="62" cy="70" r="3" fill="currentColor" className="text-muted" />
    </svg>
  );

  const pillars = [
    {
      title: "Clarity",
      desc: "Cut through the noise of millions of regulatory data points to see what matters.",
      diagram: <ClarityDiagram />,
      hudHeader: "[SYS_DECODE // MODE_INIT]",
      hudFooter: "SIGNAL DETECT: 99.8%"
    },
    {
      title: "Focus",
      desc: "Pinpoint emerging consumer harms before they escalate into systemic risk.",
      diagram: <FocusDiagram />,
      hudHeader: "[TARGET_LOCK // SCAN_AUTO]",
      hudFooter: "SCAN RATE: 480/SEC"
    },
    {
      title: "Insight",
      desc: "Pierce complex surfaces to reveal the algorithmic truth beneath.",
      diagram: <InsightDiagram />,
      hudHeader: "[DEEP_INDEX // NEURAL_LINK]",
      hudFooter: "ACCURACY: 98.42%"
    },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-[#f2faf9] font-sans selection:bg-brand/10 selection:text-brand">
      {/* Animated Matrix-like scan line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#78ede7]/30 to-transparent animate-[shimmer_8s_infinite] pointer-events-none" />

      {/* Cybernetic telemetry corner markings */}
      <div className="absolute top-6 left-6 text-[10px] font-mono text-muted/40 pointer-events-none tracking-widest hidden sm:block">
        SYS.LOC // London UK [51.5074° N, 0.1278° W]
      </div>
      <div className="absolute top-6 right-6 text-[10px] font-mono text-muted/40 pointer-events-none tracking-widest hidden sm:block">
        [MODE: ACTIVE_SUPERVISION]
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] font-mono text-muted/40 pointer-events-none tracking-widest hidden sm:block">
        REGULENS // ALPHA_v1.0.0
      </div>

      {/* Ambient high-tech glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#78ede7]/[0.08] rounded-full blur-[140px] animate-pulse-glow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-[#c7e6e5]/40 rounded-full blur-[120px] animate-pulse-glow pointer-events-none" style={{ animationDelay: "2s" }} />

      {/* High precision drafting grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(12,92,99,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(12,92,99,0.15) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex flex-col items-center w-full max-w-5xl px-6"
      >
        {/* Futuristic Floating Logo Capsule */}
        <motion.div variants={item} className="mb-6">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#0c5c63] to-[#78ede7] opacity-20 blur-lg group-hover:opacity-40 transition-opacity duration-1000 animate-pulse-glow" />
            <div className="relative w-20 h-20 rounded-2xl glass border border-line/40 flex items-center justify-center animate-float shadow-lg overflow-hidden p-3.5 bg-white/70">
              <img src={reguLensLogo} alt="ReguLens Logo" className="w-full h-full object-contain" />
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={item}
          className="text-6xl sm:text-8xl md:text-9xl font-extrabold font-heading tracking-tight text-gradient mb-2 leading-[1.05] py-3"
        >
          ReguLens
        </motion.h1>

        {/* Tagline */}
        <motion.p
          variants={item}
          className="text-lg md:text-xl text-muted font-light mb-16 text-center max-w-2xl leading-relaxed font-heading"
        >
          A new lens to view financial regulation.
        </motion.p>

        {/* Cinematic HUD Pillars */}
        <motion.div
          variants={container}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 w-full"
        >
          {pillars.map((p, i) => (
            <motion.div
              key={i}
              variants={item}
              className="glass border border-line/30 p-7 text-center group cursor-default relative overflow-hidden transition-all duration-300 hover:border-brand/40 hover:bg-white/95 bg-white/50"
            >
              {/* Corner technical lines inside card */}
              <div className="absolute top-2 left-2 text-[8px] font-mono text-muted/30 tracking-widest">{p.hudHeader}</div>
              <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-brand/35 group-hover:bg-brand animate-pulse" />

              {/* Central Vector Diagram */}
              <div className="w-16 h-16 rounded-2xl bg-accent/40 border border-line/20 flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-500 group-hover:bg-accent/60">
                {p.diagram}
              </div>

              <h3 className="text-lg font-semibold font-heading mb-2 text-ink uppercase tracking-wider">{p.title}</h3>
              <p className="text-muted leading-relaxed text-xs max-w-xs mx-auto mb-4">{p.desc}</p>

              {/* Card Footer Technical Line */}
              <div className="border-t border-line/20 pt-2.5 mt-2 text-[8px] font-mono text-muted/50 tracking-wider">
                {p.hudFooter}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Futuristic Pulsing CTA */}
        <motion.button
          variants={item}
          whileHover={{ scale: 1.03, boxShadow: "0 8px 30px rgba(12,92,99,0.25)" }}
          whileTap={{ scale: 0.97 }}
          onClick={onLaunch}
          className="px-12 py-4 bg-gradient-to-r from-[#0c5c63] to-[#7accc9] hover:from-[#073a3f] hover:to-[#0c5c63] text-white font-bold rounded-2xl text-lg transition-all flex items-center gap-3 group relative overflow-hidden shadow-md"
        >
          <span className="relative z-10 uppercase tracking-widest text-sm">Enter Dashboard</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform relative z-10" strokeWidth={2.5} />
          {/* Futuristic highlight sheen */}
          <div className="absolute -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-white/20 opacity-40 group-hover:animate-[shimmer_1.5s_ease-out_infinite]" />
        </motion.button>
      </motion.div>
    </div>
  );
}
