// Shared UI helpers: severity styling, formatters, small primitives.
import { AlertCircle, AlertTriangle, ShieldAlert, CheckCircle2, Loader2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

export const SEVERITY_HEX = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#ca8a04",
  LOW: "#059669",
};

const SEV_ICON = {
  CRITICAL: ShieldAlert,
  HIGH: AlertTriangle,
  MEDIUM: AlertCircle,
  LOW: CheckCircle2,
};

export function SeverityBadge({ band }) {
  const hex = SEVERITY_HEX[band] || SEVERITY_HEX.LOW;
  const Icon = SEV_ICON[band] || CheckCircle2;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border"
      style={{ color: hex, borderColor: `${hex}20`, background: `${hex}08` }}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      {band}
    </span>
  );
}

export function StatusBadge({ status }) {
  const styles = {
    ESCALATING: { color: "#dc2626", bg: "#dc262608", border: "#dc262620" },
    PERSISTENT: { color: "#ea580c", bg: "#ea580c08", border: "#ea580c20" },
    SIMMERING: { color: "#ca8a04", bg: "#ca8a0408", border: "#ca8a0420" },
    STABLE: { color: "#61758a", bg: "#61758a08", border: "#61758a20" },
  };
  const s = styles[status] || styles.STABLE;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border"
      style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}
    >
      <Loader2 className="w-3.5 h-3.5" strokeWidth={2} />
      {status}
    </span>
  );
}

export function GrowthPill({ value }) {
  const v = Math.round(value);
  const up = v >= 0;
  const Icon = up ? ArrowUpCircle : ArrowDownCircle;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm font-semibold ${up ? "text-critical" : "text-low"}`}>
      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      {up ? "+" : "−"}{Math.abs(v)}%
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
    <section className={`glass flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-line/30 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-ink font-heading">{title}</h2>
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="flex-1 min-h-0 overflow-auto no-scrollbar">{children}</div>
    </section>
  );
}

export function Logo({ className = "w-5 h-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Overlapping lens arcs */}
      <path
        d="M 50 20 A 38 38 0 0 1 50 80"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M 50 20 A 38 38 0 0 0 50 80"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Outer focus ring */}
      <circle
        cx="50"
        cy="50"
        r="42"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="4 8"
        className="opacity-45"
      />
      {/* Center focus indicator */}
      <circle cx="50" cy="50" r="7" fill="currentColor" />
    </svg>
  );
}
