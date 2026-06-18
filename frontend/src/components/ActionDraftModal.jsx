import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, CheckCircle2, AlertTriangle, FileText, Building2 } from "lucide-react";
import { draftAction, sendAction } from "../api.js";
import { useAudience } from "../AudienceContext.jsx";

// Item 6 — semi-automated supervisory action handling.
// Drafts a regulation-anchored letter for a recommended action, lets the
// supervisor edit it and the recipient, then records it to the (simulated)
// outbox. NO real email is sent — this keeps a human firmly in the loop.
export default function ActionDraftModal({ clusterId, clusterName, action, onClose }) {
  const { a } = useAudience();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    draftAction(clusterId, action)
      .then((d) => {
        if (!alive) return;
        setDraft(d);
        setSubject(d.subject || "");
        setBody(d.body || "");
        setEmail(d.recipient?.email || "");
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [clusterId, action]);

  const send = async () => {
    setSending(true);
    try {
      const res = await sendAction({
        cluster_id: clusterId,
        subject,
        body,
        recipient: { ...(draft?.recipient || {}), email },
        legal_basis: draft?.legal_basis,
      });
      setSent(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-md" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-2xl max-h-[92vh] bg-white border border-line/40 rounded-2xl sm:rounded-3xl shadow-[0_16px_64px_rgba(180,205,230,0.3)] overflow-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-line/30 flex items-start justify-between sticky top-0 bg-white/95 backdrop-blur-xl z-10 rounded-t-2xl sm:rounded-t-3xl">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-brand mb-1">
              <FileText className="w-4 h-4" strokeWidth={2} />
              <span className="text-xs font-bold uppercase tracking-wider">{a.actionTitle}</span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-ink leading-snug font-heading truncate">{clusterName}</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink text-2xl leading-none p-2 hover:bg-accent rounded-xl transition-colors flex-shrink-0">×</button>
        </div>

        <div className="p-5 sm:p-7 space-y-4">
          {loading && (
            <div className="py-12 flex flex-col items-center gap-3 text-muted">
              <Loader2 className="w-7 h-7 animate-spin text-brand" />
              <span className="text-sm">Drafting a compliant request…</span>
            </div>
          )}

          {error && !loading && (
            <div className="bg-critical/5 border border-critical/20 text-critical text-sm rounded-xl p-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
            </div>
          )}

          {sent ? (
            <div className="py-8 text-center space-y-3 animate-fade-in">
              <CheckCircle2 className="w-12 h-12 text-low mx-auto" />
              <h4 className="text-lg font-semibold text-ink font-heading">Recorded to outbox</h4>
              <p className="text-sm text-muted max-w-sm mx-auto">
                Reference <span className="font-mono text-ink">{sent.id}</span> queued to{" "}
                <span className="font-medium text-ink">{email}</span>.
              </p>
              <p className="text-xs text-muted/70 bg-accent/40 border border-line/30 rounded-lg px-3 py-2 inline-block">
                Simulated send — no real email was dispatched.
              </p>
              <div>
                <button onClick={onClose} className="mt-2 text-sm font-semibold text-white bg-brand hover:bg-brand-dark rounded-xl px-5 py-2.5 transition-colors">
                  Done
                </button>
              </div>
            </div>
          ) : draft && !loading ? (
            <>
              {/* Recipient */}
              <div className="glass-subtle p-4 space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Recipient (auto-matched)
                </div>
                <div className="text-sm font-medium text-ink">{draft.recipient?.firm}</div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white/80 border border-line/40 rounded-lg focus:outline-none focus:border-brand/70 focus:ring-1 focus:ring-brand/30 font-mono"
                />
                {draft.recipient?.note && (
                  <p className="text-xs text-high flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {draft.recipient.note}
                  </p>
                )}
              </div>

              {/* Legal basis + provider */}
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <span className="text-brand font-semibold bg-brand/5 border border-brand/20 rounded-md px-2.5 py-1">
                  {draft.legal_basis}
                </span>
                <span className="text-muted">drafted by: <span className="font-mono text-ink">{draft.provider}</span></span>
              </div>

              {/* Editable subject */}
              <div>
                <label className="text-xs uppercase tracking-wider text-muted">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-white/80 border border-line/40 rounded-lg focus:outline-none focus:border-brand/70 focus:ring-1 focus:ring-brand/30"
                />
              </div>

              {/* Editable body */}
              <div>
                <label className="text-xs uppercase tracking-wider text-muted">Letter</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="mt-1 w-full px-3 py-2 text-sm bg-white/80 border border-line/40 rounded-lg focus:outline-none focus:border-brand/70 focus:ring-1 focus:ring-brand/30 leading-relaxed font-sans resize-y"
                />
              </div>

              {/* Confirm + send */}
              <label className="flex items-start gap-2 text-sm text-muted cursor-pointer select-none">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 accent-brand" />
                <span>I have reviewed the letter and confirm the recipient is correct.</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button onClick={onClose} className="text-sm font-semibold text-muted hover:text-ink px-4 py-2.5 rounded-xl hover:bg-accent/40 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={send}
                  disabled={!confirmed || sending || !email}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand-dark rounded-xl px-5 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" strokeWidth={2} />}
                  {sending ? "Sending…" : "Confirm & send"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
