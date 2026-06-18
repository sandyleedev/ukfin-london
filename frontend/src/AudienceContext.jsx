import { createContext, useContext, useEffect, useState } from "react";

// Audience mode — the same engine, reframed for different units (B2G → B2B).
// Only copy / CTAs / emphasis change; the data and pipeline are identical.
export const AUDIENCES = {
  regulator: {
    label: "Regulator",
    blurb: "Supervise the market — see what to act on first.",
    lens: "Supervisory view",
    actionCta: "Draft & send",
    actionTitle: "Draft supervisory action",
    actionNoun: "supervisory action",
    accent: "#0c5c63",
  },
  bank: {
    label: "Bank compliance",
    blurb: "Your book through the regulator's lens — fix issues before they ask.",
    lens: "Self-assessment view",
    actionCta: "Draft remediation",
    actionTitle: "Draft remediation plan",
    actionNoun: "remediation",
    accent: "#7c3aed",
  },
  auditor: {
    label: "Auditor",
    blurb: "Evidence-backed conduct review — defensible and fully traceable.",
    lens: "Assurance view",
    actionCta: "Add to evidence pack",
    actionTitle: "Record audit finding",
    actionNoun: "audit finding",
    accent: "#b45309",
  },
};

const STORAGE_KEY = "regulens_audience";
const AudienceContext = createContext(null);

export function AudienceProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && AUDIENCES[saved] ? saved : "regulator";
  });

  useEffect(() => { localStorage.setItem(STORAGE_KEY, mode); }, [mode]);

  const value = { mode, setMode: setModeState, a: AUDIENCES[mode], AUDIENCES };
  return <AudienceContext.Provider value={value}>{children}</AudienceContext.Provider>;
}

export function useAudience() {
  const ctx = useContext(AudienceContext);
  if (!ctx) throw new Error("useAudience must be used within AudienceProvider");
  return ctx;
}
