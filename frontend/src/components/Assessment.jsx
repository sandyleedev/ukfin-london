import { useState } from "react";
import { AlertTriangle, Bot, Scale, Microscope, Wrench, Send } from "lucide-react";
import ActionDraftModal from "./ActionDraftModal.jsx";
import { useAudience } from "../AudienceContext.jsx";

// Normalise ai_rationale (backend may send a list of bullets or a legacy
// paragraph string) into an array of bullet points.
function toBullets(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .split(/(?<=[.!?])\s+(?=[A-Z])|;\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const PRIN_MAPPING = {
  "Consumer Support": {
    code: "PRIN 2A.6.5R · 2A.6.6R · 2A.2.2R",
    url: "https://handbook.fca.org.uk/handbook/PRIN/2A/6.html",
  },
  "Consumer Understanding": {
    code: "PRIN 2A.5.1R · 2A.5.3R · 2A.2.2R",
    url: "https://handbook.fca.org.uk/handbook/PRIN/2A/5.html",
  },
  "Products & Services": {
    code: "PRIN 2A.3.2R · 2A.3.12R · 2A.2.2R",
    url: "https://handbook.fca.org.uk/handbook/PRIN/2A/3.html",
  },
  "Price & Value": {
    code: "PRIN 2A.4.1R · 2A.4.2R · 2A.2.2R",
    url: "https://handbook.fca.org.uk/handbook/PRIN/2A/4.html",
  },
};

function Block({ Icon, title, extra, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-brand" strokeWidth={2} />
        <span className="text-sm font-bold uppercase tracking-wider text-ink">{title}</span>
        {extra}
      </div>
      {children}
    </div>
  );
}

function LikelihoodBar({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "#dc2626" : pct >= 45 ? "#ea580c" : "#ca8a04";
  return (
    <div className="flex items-center gap-2 flex-shrink-0" title={`Estimated likelihood ${pct}%`}>
      <div className="w-16 h-1.5 bg-line/30 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-xs font-semibold" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function Assessment({ assessment, clusterId, clusterName }) {
  const [draftAction, setDraftAction] = useState(null);
  const { a: audience } = useAudience();
  if (!assessment) return null;
  const a = assessment;
  const bullets = toBullets(a.ai_rationale);

  return (
    <div className="space-y-5 border-t border-line/30 pt-5 mt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-ink font-heading">Supervisory Assessment</h4>
        <span className="text-xs text-muted bg-accent/50 border border-line/30 rounded-lg px-2.5 py-1">
          {a.generated_by === "llm" ? "AI-reasoned (Claude)" : "rule-based"}
        </span>
      </div>

      <Block Icon={AlertTriangle} title="Why this is concerning">
        <p className="text-sm text-muted leading-relaxed">{a.why_concerning}</p>
      </Block>

      <Block Icon={Bot} title="Why we think it is AI-driven">
        <ul className="space-y-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted leading-relaxed">
              <span className="text-brand mt-0.5 flex-shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block Icon={Scale} title="Consumer Duty at risk">
        <div className="space-y-2">
          {a.consumer_duty?.map((d, i) => {
            const prin = PRIN_MAPPING[d.outcome] || { code: "PRIN 2A", url: "https://handbook.fca.org.uk/handbook/prin2a" };
            return (
              <div key={i} className="glass-subtle p-4">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-sm font-semibold text-brand">{d.outcome}</span>
                  <a
                    href={prin.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-brand hover:text-brand-dark hover:underline bg-brand/5 border border-brand/20 px-2.5 py-0.5 rounded-md transition-all normal-case select-none flex-shrink-0 animate-pulse-glow"
                  >
                    {prin.code}
                  </a>
                </div>
                <p className="text-sm text-muted leading-relaxed">{d.rationale}</p>
              </div>
            );
          })}
        </div>
      </Block>

      <Block Icon={Microscope} title="Likely mechanism">
        <div className="space-y-2.5">
          {a.hypotheses?.map((h, i) => (
            <div key={i} className="glass-subtle p-4">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <p className="text-sm text-ink leading-snug">{h.mechanism}</p>
                <LikelihoodBar value={h.likelihood} />
              </div>
              <p className="text-sm text-muted leading-relaxed">
                <span className="font-semibold">Evidence:</span> {h.evidence}
              </p>
            </div>
          ))}
        </div>
      </Block>

      <Block Icon={Wrench} title="Recommended actions">
        <ol className="space-y-2">
          {a.actions?.map((act, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-sm font-bold text-brand mt-0.5 flex-shrink-0">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink leading-snug">{act.action}</p>
                <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
                  <p className="text-xs text-brand">{act.basis}</p>
                  {clusterId && (
                    <button
                      onClick={() => setDraftAction(act.action)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-dark rounded-lg px-2.5 py-1 transition-colors flex-shrink-0"
                    >
                      <Send className="w-3 h-3" strokeWidth={2} />
                      {audience.actionCta}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Block>

      {draftAction && (
        <ActionDraftModal
          clusterId={clusterId}
          clusterName={clusterName}
          action={draftAction}
          onClose={() => setDraftAction(null)}
        />
      )}
    </div>
  );
}
