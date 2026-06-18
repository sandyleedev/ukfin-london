# ReguLens — Business & Go-to-Market

ReguLens started as a **B2G** tool for financial regulators, but the core engine
— *mine complaint/issue data → discover AI/automation harm patterns → rank →
explain → action* — is valuable to anyone who has to find and evidence conduct
risk. This note sketches the path from B2G to B2B.

## Who it serves

| Segment | Buyer | The job they hire ReguLens for |
|---|---|---|
| **B2G — Regulators** | FCA / conduct supervisors, central banks, ombudsman | Spot emerging consumer harm early; prioritise a finite supervision team; evidence interventions (s.165/s.166, Consumer Duty). |
| **B2B — Bank / fintech compliance** | Chief Compliance / Conduct Officer, RegTech teams | Self-monitor before the regulator does; triage their *own* complaint book for automation-driven harm; pre-empt s.165 requests. |
| **B2B — Audit firms** | Big-4 / assurance practices | Evidence-backed conduct & model-risk reviews at scale; defensible sampling; an audit trail of how a finding was reached. |
| **B2B — Consultancies** | Risk/regulatory advisory | Rapid diagnostics for clients facing reviews; benchmark a client's complaint patterns against the market. |

## Why the same engine transfers

- The pipeline is **data-source agnostic**: today CFPB; tomorrow a firm's
  internal complaints, FOS data, app-store reviews, or call-centre transcripts.
- The outputs (ranked clusters, Consumer Duty mapping, mechanism hypotheses,
  drafted actions) are exactly what a compliance/audit team must produce anyway.
- Explainability (transparent scoring, rule-based fallback, source citations) is
  a *requirement* in all four segments, not a nice-to-have.

## Product adaptations per segment

- **Bring-your-own-data connectors** — ingest a firm's complaint export
  (CSV/API), Salesforce/Zendesk, FOS decisions. The filter/cluster/score stages
  stay the same.
- **Multi-tenant + white-label** — per-tenant isolation, themeable UI, so an
  audit firm or bank can run it under their own brand.
- **Firm "self-assessment" mode** — flip the framing from "supervise firms" to
  "here's what a regulator would see in *your* book, and how to fix it first".
- **Audit-evidence export** — immutable run records, sampling rationale, and a
  per-finding evidence trail (cases → cluster → assessment → action) as a
  portable dossier (PDF/JSON).
- **Benchmarking** — anonymised cross-firm pattern prevalence (consultancy value).

## Phased GTM

1. **Phase 1 — B2G credibility.** Land a regulator/sandbox pilot; the public
   demo (CFPB data) is the shop window. Prove early-warning + explainability.
2. **Phase 2 — B2B compliance self-monitoring.** Sell the *same* dashboard to
   firms as "see yourself through the regulator's lens", powered by their data
   via connectors. Natural pull: firms want to fix issues before a s.165 lands.
3. **Phase 3 — Audit & consultancy.** Package as an assurance accelerator
   (multi-tenant, evidence export, benchmarking) for firms running many client
   engagements.

## Commercial model (sketch)

- B2G: annual licence / public-sector procurement.
- B2B compliance: per-seat + data-volume tiers (SaaS).
- Audit/consultancy: per-engagement or firm-wide platform licence + usage.

## Moats to build

- Domain-tuned harm taxonomy + Consumer Duty mapping (hard to replicate well).
- A feedback loop that improves with each expert accept/reject (see
  [ROADMAP.md](ROADMAP.md)) — data network effect.
- Audit-grade explainability and provenance baked into every output.
