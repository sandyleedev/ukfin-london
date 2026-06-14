// Shared UI helpers: severity styling, formatters, small primitives.
import { AlertCircle, AlertTriangle, ShieldAlert, CheckCircle2, PlayCircle, Loader2 } from "lucide-react";

export const SEVERITY_HEX = {
  CRITICAL: "#dc2b4b",
  HIGH: "#f0762b",
  MEDIUM: "#e0a92e",
  LOW: "#3fa66a",
};

export function SeverityBadge({ band }) {
  let color = "text-muted border-line";
  let bg = "bg-white";
  let Icon = AlertCircle;
  if (band === "critical") {
    color = "text-critical border-critical/30";
    bg = "bg-critical/5";
    Icon = ShieldAlert;
  } else if (band === "high") {
    color = "text-high border-high/30";
    bg = "bg-high/5";
    Icon = AlertTriangle;
  } else if (band === "medium") {
    color = "text-medium border-medium/30";
    bg = "bg-medium/5";
    Icon = AlertCircle;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-md ${color} ${bg}`}>
      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      {band}
    </span>
  );
}

export function StatusBadge({ status }) {
  let color = "text-muted border-line";
  let bg = "bg-white";
  let Icon = Loader2;
  if (status === "escalated") {
    color = "text-brand border-brand/30";
    bg = "bg-brand/5";
    Icon = AlertCircle;
  } else if (status === "investigating") {
    color = "text-accent border-accent/30";
    bg = "bg-accent/5";
    Icon = PlayCircle;
  } else if (status === "monitoring") {
    color = "text-low border-low/30";
    bg = "bg-low/5";
    Icon = CheckCircle2;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-md ${color} ${bg}`}>
      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      {status}
    </span>
  );
}

// "+312%" green-up / red-down with sign.
export function GrowthPill({ value }) {
  const v = Math.round(value);
  const up = v >= 0;
  return (
    <span className={`font-mono text-xs font-semibold ${up ? "text-critical" : "text-low"}`}>
      {up ? "+" : "−"}
      {Math.abs(v)}%
    </span>
  );
}

export function fmtTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function Panel({ title, subtitle, right, children, className = "" }) {
  return (
    <section className={`surface-panel flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-shrink-0">
        <div>
          <h2 className="text-lg font-heading font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="flex-1 min-h-0 overflow-auto no-scrollbar">{children}</div>
    </section>
  );
}
