import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Boxes, FolderSearch, SlidersHorizontal } from "lucide-react";
import reguLensLogo from "../ReguLensLogo.png";

const NAV = [
  { to: "/overview", label: "Overview", Icon: LayoutDashboard },
  { to: "/clusters", label: "Clusters", Icon: Boxes },
  { to: "/cases", label: "Cases", Icon: FolderSearch },
  { to: "/scoring", label: "Scoring", Icon: SlidersHorizontal },
];

export default function Header({ generatedAt }) {
  const [time, setTime] = useState("");
  const navigate = useNavigate();

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
          onClick={() => navigate("/")}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center border border-[#7accc9]/25 cursor-pointer overflow-hidden p-1.5 transition-all duration-300 hover:scale-105 hover:border-[#78ede7]/60 bg-white/10 group"
          title="Return to Landing Page"
        >
          <div className="absolute -inset-1 bg-[#78ede7]/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <img src={reguLensLogo} alt="ReguLens Logo" className="relative z-10 w-full h-full object-contain" />
        </a>
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-base font-heading tracking-tight text-white">ReguLens</span>
          <span className="flex items-center gap-1 text-[8px] font-bold tracking-widest bg-critical/10 text-critical border border-critical/20 px-1.5 py-0.5 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-critical animate-ping" />
            ACTIVE
          </span>
        </div>
      </div>

      {/* Center section: primary navigation */}
      <nav className="flex items-center gap-1 border-l border-white/15 pl-6 ml-2">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold tracking-tight transition-all duration-200 ${
                isActive
                  ? "bg-[#78ede7]/15 text-white border border-[#78ede7]/30"
                  : "text-[#c7e6e5]/70 hover:text-white hover:bg-white/5 border border-transparent"
              }`
            }
          >
            <Icon className="w-4 h-4" strokeWidth={2} />
            <span className="hidden md:inline">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Right section: datafeed indicator + clock */}
      <div className="ml-auto flex items-center gap-6">
        <div className="hidden lg:flex flex-col text-[10px] font-mono">
          <span className="text-white/45 text-[9px] uppercase tracking-wider">datafeed</span>
          <span className="text-[#78ede7] font-semibold flex items-center gap-1">
            CFPB_LIVE
            <span className="w-1 h-1 rounded-full bg-[#78ede7] animate-pulse" />
          </span>
        </div>

        <div className="w-[1px] h-6 bg-white/15 hidden sm:block" />

        <div className="hidden sm:flex flex-col items-end text-right font-mono text-[10px]">
          <span className="text-white font-bold tracking-widest text-xs">{time || "--:--:--"}</span>
          <span className="text-white/50 text-[9px] mt-0.5">{dateStr}</span>
        </div>
      </div>
    </header>
  );
}
