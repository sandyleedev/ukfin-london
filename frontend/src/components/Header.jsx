import reguLensLogo from "../ReguLensLogo.png";

export default function Header({ generatedAt, adjudicator, onOverview }) {
  const date = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  return (
    <header className="h-16 flex items-center px-6 gap-5 flex-shrink-0 bg-surface/80 backdrop-blur-xl border-b border-white/[0.06] z-30">
      <div className="flex items-center gap-3">
        <a onClick={onOverview} className="w-9 h-9 rounded-xl flex items-center justify-center border border-brand/20 cursor-pointer overflow-hidden p-1.5">
          <img src={reguLensLogo} alt="ReguLens Logo" className="w-full h-full object-contain" />
        </a>
        <span className="font-bold text-lg font-heading tracking-tight text-ink">ReguLens</span>
        <span className="text-white/20 text-lg">|</span>
        <span className="text-muted text-sm font-medium">Supervision Intelligence</span>
      </div>

      <span className="text-[10px] font-bold tracking-[0.2em] uppercase bg-brand/10 text-brand border border-brand/20 px-3 py-1 rounded-lg">
        Alpha
      </span>

      <div className="ml-auto flex items-center gap-4 text-sm text-muted">
        <span className="capitalize">{adjudicator || "—"}</span>
        <span className="text-white/10">|</span>
        <span>{date}</span>
      </div>
    </header>
  );
}
