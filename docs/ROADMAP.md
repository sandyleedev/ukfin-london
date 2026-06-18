# ReguLens — Roadmap & Known Limitations

This document is deliberately honest about where the system still has **black
boxes** (places a sceptical regulator would rightly push back) and how we intend
to close them, plus the cloud/scaling plan.

## Known limitations / "black boxes" to improve

| Area | Current state (the black box) | Why it matters | Improvement direction |
|---|---|---|---|
| **Cluster count `k`** | KMeans `k` is chosen by silhouette over a small range (`cluster.py`); the *number* of harm patterns is still data-driven but not explained per-decision. | A supervisor can't see *why* there are N clusters, not N±1. | Surface the silhouette curve + per-cluster cohesion in the UI; consider HDBSCAN (no fixed `k`) and topic labels validated by an LLM. |
| **Cluster naming** | Labels are top TF-IDF terms + modal issue. Occasionally terse or boilerplate-y. | Names drive triage; a bad name hides a real pattern. | LLM-generated, human-readable cluster names grounded in the member narratives, with the TF-IDF terms shown as evidence. |
| **Severity & priority weights** | Heuristic priors (`0.44/0.31/0.25` severity; `0.28/0.33/0.22/0.17` priority). Tunable, but the *defaults* are judgement, not calibration. | Priors decide what gets attention first. | Calibrate against historical FCA enforcement / known-harm outcomes; expose sensitivity analysis. |
| **`REG_RELEVANCE` priors** | Hardcoded per-category 0–1 map (`scoring.py`). | Encodes a fixed view of what matters to the FCA remit. | Make it config-driven / regulator-editable; version it. |
| **No feedback loop** | Adjudication & assessments are one-shot; nothing learns from a supervisor confirming/rejecting a flag. | The model can't improve from expert judgement. | Capture accept/reject on cases & clusters → a labelled set → fine-tune/threshold-tune Stage 1–2. |
| **Mechanism hypotheses** | Plausible *templates* per category, lifted by signal strength (`assessment.py`). Clearly framed as hypotheses, but not validated against firm data. | Could anchor a supervisor on the wrong mechanism. | Keep them as ranked hypotheses; add a "what evidence would confirm/refute this" prompt and link to the s.165 request that tests it. |
| **Per-case LLM rationale** | The Stage-2 adjudicator stores a `rationale` per case, but the UI doesn't surface it yet. | Explainability is buried. | Show the adjudicator's reasoning inline in the Case Explorer. |
| **Month-boundary dedup** | The crawl can fetch a complaint twice at month edges; deduped by `complaint_id` at read time. | Edge-case double counting if IDs are missing. | Dedup at crawl time; reconcile counts. |
| **Live web-news correlation** | Best-effort, provider-dependent (Claude web search / Gemini grounding); quality varies and may return nothing. | A demo "wow" feature shouldn't be mistaken for ground truth. | Cache results; show provenance + confidence; fall back to data-only (already implemented). |
| **Simulated send** | Action drafting writes to a file outbox; **no real email** is dispatched, and recipient contact details are a stub. | Must never be mistaken for a real regulatory action. | Integrate the FCA Register for real recipient resolution; add SMTP/secure channel behind explicit auth + audit when productionised. |
| **Auth** | Scoring edit is gated by a demo passcode; engine selection is unauthenticated. | Not production access control. | SSO / RBAC; per-action authorisation + full audit trail. |

## Cloud & scaling plan (AWS / GCP)

Today: frontend on **Vercel**, API on **Render** (free tiers; `dashboard.json`
committed so no crawl at deploy). Intended production path:

- **API** → containerised FastAPI on **AWS ECS/Fargate** or **GCP Cloud Run**
  (autoscale to zero; no cold-start tax).
- **Artifacts** (`dashboard.json`, future model outputs) → **S3** / **GCS**; the
  API reads the latest object rather than a committed file.
- **Scheduled crawl + rebuild** → **EventBridge + Fargate task** / **Cloud
  Scheduler + Cloud Run Job** on a cadence (e.g. nightly).
- **Secrets** → **AWS Secrets Manager** / **GCP Secret Manager**.
- **Observability** → CloudWatch / Cloud Logging + request tracing on the live
  LLM endpoints (latency/cost budgets).
- **Frontend** → CloudFront + S3 or Firebase Hosting (or keep Vercel).

## Near-term feature backlog

- Surface per-case adjudicator rationale in the Case Explorer.
- LLM-generated cluster names + an "explain this cluster" action.
- An Outbox / action-log view (the `/api/outbox` endpoint already exists).
- Export a cluster's assessment as a PDF dossier.
- Regulator-editable category relevance + weight presets.
