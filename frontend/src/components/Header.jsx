import { Aperture } from "lucide-react";

export default function Header({ generatedAt, adjudicator, onOverview }) {
  const date = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  return (
    <header className="h-16 flex items-center px-8 gap-6 flex-shrink-0 bg-white border-b border-line z-30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-brand text-white shadow-sm">
          <Aperture className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <span className="font-semibold text-xl font-heading tracking-tight text-brand">ReguLens</span>
        <span className="text-line text-lg ml-2">|</span>
        <span className="text-muted text-sm font-medium ml-2">FCA Supervision Intelligence</span>
      </div>

      <span className="text-[10px] font-bold tracking-widest bg-bg border border-line text-brand px-2.5 py-1 rounded-md ml-2">
        ALPHA
      </span>

      <nav className="flex items-center gap-2 ml-8 text-sm font-medium">
        <a className="px-3 py-1.5 rounded-lg bg-bg text-brand">Supervision</a>
        <a onClick={onOverview} className="px-3 py-1.5 rounded-lg text-muted hover:bg-bg hover:text-brand cursor-pointer transition-colors">Overview</a>
      </nav>

      <div className="ml-auto flex items-center gap-4 text-xs font-medium text-muted">
        <span className="capitalize">Adjudicator: {adjudicator || "—"}</span>
        <span className="text-line">|</span>
        <span>{date} · Daily View</span>
      </div>
    </header>
  );
}
