import { useEffect, useState } from "react";
import { Mailbox, Building2, Scale, Clock, ChevronDown, Inbox } from "lucide-react";
import { fetchOutbox } from "../api.js";
import { Panel, fmtTime } from "../ui.jsx";

// Action log — every supervisory action drafted and "sent" (simulated) via the
// cluster drawer. Backed by /api/outbox (a file-based outbox; no real email).
export default function Outbox() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetchOutbox()
      .then((r) => setItems(r.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-ink">Action Log</h1>
        <p className="text-sm text-muted mt-1">
          Supervisory actions drafted and dispatched from the harm clusters.
          <span className="ml-1 text-[11px] font-semibold bg-high/10 text-high border border-high/20 px-2 py-0.5 rounded-md">Simulated — no real email is sent</span>
        </p>
      </div>

      <Panel title="Outbox" subtitle={`${items.length} action${items.length === 1 ? "" : "s"} recorded`} className="min-h-[420px]">
        {loading ? (
          <div className="py-16 text-center text-muted text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted">
            <Inbox className="w-10 h-10 opacity-40" />
            <p className="text-sm">No actions yet. Open a cluster → <span className="text-brand font-medium">Draft &amp; send</span> to create one.</p>
          </div>
        ) : (
          <ul>
            {items.slice().reverse().map((it) => {
              const open = expanded === it.id;
              return (
                <li key={it.id} className="border-b border-line/20 last:border-b-0">
                  <button onClick={() => setExpanded(open ? null : it.id)} className="w-full text-left px-5 sm:px-6 py-4 hover:bg-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Mailbox className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                          <span className="font-mono text-xs text-muted">{it.id}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-low/10 text-low border border-low/20 px-1.5 py-0.5 rounded">sent</span>
                        </div>
                        <div className="text-sm font-semibold text-ink truncate">{it.subject}</div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted mt-1">
                          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {it.recipient?.firm || "—"}</span>
                          <span className="font-mono">{it.recipient?.email}</span>
                          {it.legal_basis && <span className="flex items-center gap-1 text-brand"><Scale className="w-3 h-3" /> {it.legal_basis}</span>}
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtTime(it.sent_at)}</span>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  {open && (
                    <div className="px-5 sm:px-6 pb-5">
                      <pre className="text-xs text-muted leading-relaxed whitespace-pre-wrap font-sans glass-subtle rounded-xl p-4">{it.body}</pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
