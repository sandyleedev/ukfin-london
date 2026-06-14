import { useEffect, useState } from "react";
import reguLensLogo from "../ReguLensLogo.png";

export default function Header({ generatedAt, adjudicator, onOverview }) {
  const [time, setTime] = useState("");

  // Live real-time clock updating every second
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <header className="h-16 flex items-center px-6 gap-6 flex-shrink-0 bg-[#384250] text-[#c7e6e5] border-b border-[#0c5c63]/40 z-30 relative overflow-hidden select-none">
      {/* HUD scanning swipe line inside the header bottom */}
      <div className="absolute bottom-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-[#78ede7]/50 to-transparent animate-[shimmer_4s_linear_infinite]" />

      {/* Left section: Logo and Title */}
      <div className="flex items-center gap-3">
        <a
          onClick={onOverview}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center border border-[#7accc9]/25 cursor-pointer overflow-hidden p-1.5 transition-all duration-300 hover:scale-105 hover:border-[#78ede7]/60 bg-white/10 group"
          title="Return to Landing Page"
        >
          {/* Logo hover glow */}
          <div className="absolute -inset-1 bg-[#78ede7]/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <img src={reguLensLogo} alt="ReguLens Logo" className="relative z-10 w-full h-full object-contain" />
        </a>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base font-heading tracking-tight text-white">ReguLens</span>
            {/* Blinking Live Radar Icon */}
            <span className="flex items-center gap-1 text-[8px] font-bold tracking-widest bg-critical/10 text-critical border border-critical/20 px-1.5 py-0.5 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-critical animate-ping" />
              ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Center section: High-tech Telemetry Stream (Hidden on mobile) */}
      <div className="hidden md:flex items-center gap-6 text-[10px] font-mono border-l border-white/15 pl-6 ml-2">
        <div className="flex flex-col">
          <span className="text-white/45 text-[9px] uppercase tracking-wider">datafeed</span>
          <span className="text-[#78ede7] font-semibold flex items-center gap-1">
            CFPB_LIVE
            <span className="w-1 h-1 rounded-full bg-[#78ede7] animate-pulse" />
          </span>
        </div>

        <div className="w-[1px] h-6 bg-white/15" />

        <div className="flex flex-col">
          <span className="text-white/45 text-[9px] uppercase tracking-wider">crawler_freq</span>
          <span className="text-white font-semibold">14.6 REQ/S</span>
        </div>

        <div className="w-[1px] h-6 bg-white/15" />

        <div className="flex flex-col">
          <span className="text-white/45 text-[9px] uppercase tracking-wider">integrity</span>
          <span className="text-low font-semibold flex items-center gap-1">
            SECURE
            <span className="w-1 h-1 rounded-full bg-low" />
          </span>
        </div>
      </div>

      {/* Right section: System Date, Real-time Clock, and Alpha badge */}
      <div className="ml-auto flex items-center gap-6">

        <div className="w-[1px] h-6 bg-white/15 hidden sm:block" />

        {/* Dynamic High-tech Time & Date Block */}
        <div className="hidden sm:flex flex-col items-end text-right font-mono text-[10px]">
          <span className="text-white font-bold tracking-widest text-xs">{time || "--:--:--"}</span>
          <span className="text-white/50 text-[9px] mt-0.5">{dateStr}</span>
        </div>
      </div>
    </header>
  );
}
