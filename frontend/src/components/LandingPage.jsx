import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Target, Eye } from "lucide-react";
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

  const pillars = [
    { title: "Clarity", desc: "Cut through the noise of millions of regulatory data points to see what matters.", Icon: Sparkles },
    { title: "Focus", desc: "Pinpoint emerging consumer harms before they escalate into systemic risk.", Icon: Target },
    { title: "Insight", desc: "Pierce complex surfaces to reveal the algorithmic truth beneath.", Icon: Eye },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-white via-accent/30 to-bg">
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand/[0.04] rounded-full blur-[120px] animate-pulse-glow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-accent/40 rounded-full blur-[100px] animate-pulse-glow pointer-events-none" style={{ animationDelay: "1.5s" }} />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(37,99,235,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.2) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex flex-col items-center w-full max-w-5xl px-6"
      >
        {/* Logo */}
        <motion.div variants={item} className="mb-8">
          <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center animate-float shadow-lg overflow-hidden p-3.5">
            <img src={reguLensLogo} alt="ReguLens Logo" className="w-full h-full object-contain" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={item}
          className="text-7xl sm:text-8xl md:text-9xl font-extrabold font-heading tracking-tight text-gradient mb-2 h-40"
        >
          ReguLens
        </motion.h1>

        {/* Tagline */}
        <motion.p
          variants={item}
          className="text-xl md:text-2xl text-muted font-light mb-6 text-center max-w-2xl leading-relaxed"
        >
          A new lens to view financial regulation.
        </motion.p>

        {/* Three pillars */}
        <motion.div
          variants={container}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 w-full"
        >
          {pillars.map((p, i) => (
            <motion.div
              key={i}
              variants={item}
              className="glass glass-hover p-8 text-center group cursor-default"
            >
              <div className="w-14 h-14 rounded-2xl bg-accent border border-line/30 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                <p.Icon className="w-7 h-7 text-brand" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-semibold font-heading mb-3 text-ink">{p.title}</h3>
              <p className="text-muted leading-relaxed text-sm">{p.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.button
          variants={item}
          whileHover={{ scale: 1.03, boxShadow: "0 8px 40px rgba(37,99,235,0.2)" }}
          whileTap={{ scale: 0.97 }}
          onClick={onLaunch}
          className="px-10 py-4 bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold rounded-2xl text-lg shadow-[0_4px_20px_rgba(37,99,235,0.15)] transition-all flex items-center gap-3 group"
        >
          <span>Enter Dashboard</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={2} />
        </motion.button>
      </motion.div>
    </div>
  );
}
