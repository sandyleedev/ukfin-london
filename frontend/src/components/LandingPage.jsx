import { motion } from "framer-motion";
import { Aperture, ArrowRight, CheckCircle2, Target, Eye } from "lucide-react";

export default function LandingPage({ onLaunch }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } // Custom easing for premium feel
    }
  };

  const pillarVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-bg text-ink relative overflow-hidden font-sans">

      {/* Ultra-minimal ambient background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-bg to-bg -z-10" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center z-10 w-full max-w-5xl px-8"
      >
        <motion.div variants={itemVariants} className="mb-8">
          <div className="w-20 h-20 rounded-[24px] flex items-center justify-center bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-line mx-auto">
            <Aperture className="w-10 h-10 text-brand" strokeWidth={1.5} />
          </div>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="text-7xl md:text-9xl font-semibold font-heading tracking-tight mb-6 text-brand"
        >
          ReguLens.
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="text-xl md:text-3xl text-muted font-light mb-20 text-center max-w-3xl leading-relaxed tracking-wide"
        >
          A new lens for financial regulation.
        </motion.p>

        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-24 w-full"
        >
          {[
            { title: "Clarity", desc: "Cut through millions of data points.", icon: CheckCircle2 },
            { title: "Focus", desc: "Pinpoint emerging consumer harms.", icon: Target },
            { title: "Insight", desc: "Reveal the algorithmic truth.", icon: Eye }
          ].map((pillar, i) => (
            <motion.div
              key={i}
              variants={pillarVariants}
              className="flex flex-col items-center text-center group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white border border-line shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 ease-out">
                <pillar.icon className="w-5 h-5 text-brand" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-medium font-heading mb-3">{pillar.title}</h3>
              <p className="text-muted leading-relaxed font-light">{pillar.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.button
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLaunch}
          className="px-10 py-5 bg-brand text-white font-medium rounded-full text-lg shadow-[0_8px_30px_rgb(15,23,42,0.2)] hover:shadow-[0_8px_30px_rgb(15,23,42,0.3)] transition-all flex items-center gap-3 group"
        >
          <span>Enter Workspace</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={2} />
        </motion.button>

      </motion.div>
    </div>
  );
}
