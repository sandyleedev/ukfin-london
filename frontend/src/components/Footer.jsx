import { Building2, Landmark, ShieldCheck, LineChart, Banknote } from "lucide-react";

// Standard site footer with simulated partner/customer wordmarks.
// These firms are fictional placeholders for demo purposes only.
const PARTNERS = [
  { name: "NorthBank", Icon: Landmark },
  { name: "Veritas Audit", Icon: ShieldCheck },
  { name: "Lumen Capital", Icon: LineChart },
  { name: "FairPay", Icon: Banknote },
  { name: "Meridian Trust", Icon: Building2 },
];

export default function Footer() {
  return (
    <footer className="mt-8 pt-6 pb-8 border-t border-line/30">
      <div className="text-center text-[10px] uppercase tracking-[0.2em] text-muted/60 mb-5">
        Trusted by supervision &amp; compliance teams
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 mb-6 opacity-60">
        {PARTNERS.map(({ name, Icon }) => (
          <div key={name} className="flex items-center gap-2 text-muted grayscale hover:grayscale-0 hover:text-brand transition-all duration-300">
            <Icon className="w-4 h-4" strokeWidth={2} />
            <span className="text-sm font-semibold font-heading tracking-tight">{name}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-muted/70">
        <span>© {new Date().getFullYear()} ReguLens</span>
        <span className="hidden sm:inline text-line">·</span>
        <span>A new lens to view financial regulation</span>
        <span className="hidden sm:inline text-line">·</span>
        <span className="text-muted/50">Demo — partner names are illustrative</span>
      </div>
    </footer>
  );
}
