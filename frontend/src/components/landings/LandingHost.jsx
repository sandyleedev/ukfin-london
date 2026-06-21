import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { LANDINGS, DEFAULT_LANDING } from "./index.js";

// Picks the active landing variant (from ?landing= or the configured default)
// and renders a small floating switcher so variants can be reviewed live.
// Remove <VariantSwitcher/> (or the SHOW_SWITCHER flag) before a final ship.
const SHOW_SWITCHER = true;

export default function LandingHost({ onLaunch }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get("landing");
  const key = requested && LANDINGS[requested] ? requested : DEFAULT_LANDING;
  const { Component } = LANDINGS[key];

  return (
    <>
      <Component onLaunch={onLaunch} />
      {SHOW_SWITCHER && <VariantSwitcher activeKey={key} onPick={(k) => {
        const next = new URLSearchParams(params);
        next.set("landing", k);
        setParams(next, { replace: true });
      }} />}
    </>
  );
}

function VariantSwitcher({ activeKey, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
      {open && (
        <div className="bg-white border border-line/40 rounded-2xl shadow-xl p-2 flex flex-col gap-1 animate-fade-in min-w-[180px]">
          <div className="text-[10px] uppercase tracking-widest text-muted/60 px-2 py-1">Homepage preview</div>
          {Object.entries(LANDINGS).map(([k, { label }]) => (
            <button
              key={k}
              onClick={() => onPick(k)}
              className={`text-left text-sm font-semibold px-3 py-2 rounded-xl transition-colors ${
                k === activeKey ? "bg-brand/10 text-brand" : "text-ink hover:bg-accent/50"
              }`}
            >
              {label}
            </button>
          ))}
          <div className="text-[10px] text-muted/50 px-2 pt-1">Set the default in landings/index.js</div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-ink text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg hover:opacity-90 transition-opacity"
        title="Preview homepage variants"
      >
        <LayoutGrid className="w-4 h-4" /> Homepage: {LANDINGS[activeKey].label}
      </button>
    </div>
  );
}
