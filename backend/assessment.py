"""
assessment.py — Sentinel Stage 5: turn each ranked cluster into a supervisory
dossier a regulator can act on.

For every cluster it answers the questions the FCA mentor asked for:

  • Why is this case concerning?
  • Why do we think it is AI / automation driven?
  • Which Consumer Duty outcome(s) is it putting at risk?
  • What is the most likely *mechanism* — a reasoned, evidence-grounded
    hypothesis of how the firm's automation is producing the harm — with a
    likelihood and the evidence behind it.
  • What concrete actions can the regulator take, with the legal / regulatory
    basis (s.165 information request, s.166 skilled person, Equality Act
    impact assessment, Consumer Duty outcomes assessment, …).

Two backends (same shape as llm_adjudicator):
  • "llm"   — Claude reads the cluster's real narratives and reasons about it.
  • "rules" — a grounded knowledge-base generator (no key, fully auditable).
  • "auto"  — llm if ANTHROPIC_API_KEY is set, else rules.

The estimates are *hypotheses to investigate*, not findings — every mechanism
carries a likelihood < 1 and the evidence it rests on, so a supervisor can
decide whether to open an enquiry.
"""

import logging
import os
import re
from typing import Dict, List

logger = logging.getLogger("assessment")

LLM_MODEL = os.environ.get("REGUTRIAGE_LLM_MODEL", "claude-opus-4-8")

# --- FCA Consumer Duty outcomes (PRIN 2A / Principle 12) --------------------
DUTY = {
    "support": "Consumer Support",
    "understanding": "Consumer Understanding",
    "products": "Products & Services",
    "value": "Price & Value",
}

# Which Consumer Duty outcome each detection signal most directly threatens.
SIGNAL_TO_DUTY = {
    "no_human": ("support",
                 "Customers cannot reach a human to question or reverse an "
                 "automated decision — an unreasonable barrier to support and redress."),
    "loop_runaround": ("support",
                       "Customers are trapped in automated loops with no escalation "
                       "path, frustrating their ability to resolve the issue."),
    "no_explanation": ("understanding",
                       "Adverse decisions are issued without an intelligible reason, "
                       "so customers cannot understand or challenge them."),
    "action_without_notice": ("support",
                              "Accounts/cards are actioned without notice, denying "
                              "customers the chance to respond before harm crystallises."),
    "auto_adverse_action": ("products",
                            "Automated adverse actions are taken at scale, raising "
                            "doubt that the journey is designed to deliver good outcomes."),
}

# --- Category → plausible algorithmic mechanism templates -------------------
# Each entry: (mechanism, base_likelihood, evidence_hint, context_keywords)
# context_keywords sharpen the hypothesis when present in the narratives.
CATEGORY_MECHANISMS = {
    "Banking": [
        ("The firm likely tightened an automated transaction-monitoring / "
         "financial-crime model, raising false-positive exit rates — legitimate "
         "customers are 'de-risked' and offboarded without manual review.",
         0.55, "account-closure and suspicious-activity language concentrated at a few firms",
         ["suspicious", "money laundering", "aml", "closed", "fraud", "froze", "frozen"]),
        ("An automated fraud-detection model may be flagging legitimate "
         "transactions, freezing funds before any human check.",
         0.4, "fund-freeze and access-loss cues", ["froze", "frozen", "locked", "hold", "access"]),
    ],
    "Cards & Payments": [
        ("An automated account-closure / fraud model appears to be exiting "
         "customers and reversing payments without manual review or notice.",
         0.55, "automated closure and payment-reversal cues",
         ["closed", "closure", "suspicious", "fraud", "reversed", "blocked"]),
    ],
    "Payments & Crypto": [
        ("Automated AML / sanctions screening is likely freezing withdrawals; a "
         "recent model change may have increased false positives on legitimate users.",
         0.55, "withdrawal-freeze and verification-failure cues",
         ["withdraw", "frozen", "verification", "blocked", "sanction", "aml"]),
    ],
    "Consumer Credit": [
        ("An automated affordability / credit-decisioning model was likely "
         "recalibrated, raising decline rates. Because such models lean on proxy "
         "variables, there is a real risk of indirect discrimination.",
         0.5, "automated decline and affordability cues",
         ["denied", "declined", "affordability", "rejected", "approval"]),
    ],
    "Mortgages": [
        ("Automated underwriting / affordability logic or an automated "
         "rate-switching process appears to be producing detriment without a "
         "clear, individualised rationale.",
         0.45, "automated underwriting and rate-switch cues",
         ["underwrit", "rate", "switch", "denied", "affordability"]),
    ],
    "Insurance": [
        ("An automated claims / underwriting model may be denying or pricing "
         "cover using proxies that correlate with protected characteristics, "
         "without giving customers a reason — a discrimination and fairness risk.",
         0.5, "unexplained denial and pricing cues",
         ["denied", "claim", "premium", "underwrit", "rejected"]),
    ],
    "Credit Reporting": [
        ("Automated dispute resolution (e-OSCAR-style) is likely closing "
         "investigations without genuine human review, leaving errors uncorrected.",
         0.55, "automated-investigation and unresolved-dispute cues",
         ["investigation", "dispute", "incorrect", "inaccurate"]),
    ],
    "Debt Collection": [
        ("Automated dialer / letter systems may be pursuing debts not owed, with "
         "no easy route to a human to correct the record.",
         0.45, "debt-not-owed and automated-contact cues",
         ["not owed", "wrong", "validation", "automated"]),
    ],
}

# Discrimination escalator — if these appear, add an Equality Act hypothesis/action.
DISCRIMINATION_HINTS = ["discriminat", "race", "ethnic", "gender", "disab",
                        "religio", "postcode", "name", "profil", "bias"]


def _ctx_text(cluster: Dict) -> str:
    return " ".join([cluster.get("name", "")] + (cluster.get("sample_narratives") or [])).lower()


def _ai_rationale(cluster: Dict) -> str:
    kws = cluster.get("matched_keywords") or []
    sigs = cluster.get("matched_signals") or []
    bits = []
    if kws:
        bits.append(f"complaints explicitly reference automation ({', '.join(kws[:4])})")
    if sigs:
        readable = {
            "no_human": "no human reachable", "loop_runaround": "automated loops",
            "no_explanation": "decisions given with no explanation",
            "action_without_notice": "actions taken without notice",
            "auto_adverse_action": "automated adverse actions",
        }
        bits.append("the harm fingerprint of automated decisioning ("
                    + ", ".join(readable.get(s, s) for s in sigs[:4]) + ")")
    base = "; and ".join(bits) if bits else "recurring patterns consistent with automated handling"
    return (f"Flagged AI/automation-related because {base}. "
            f"The pattern is concentrated and repeating across {cluster.get('cases', 0)} "
            f"complaints, which is more consistent with a systematic automated process "
            f"than with isolated human error.")


def _why_concerning(cluster: Dict) -> str:
    g = cluster.get("growth_7d", 0)
    sev = cluster.get("severity_band", "MEDIUM")
    comp = cluster.get("companies") or []
    firm = comp[0] if comp else "the firm(s)"
    trend = (f"accelerating fast (+{g:.0f}% in 7 days)" if g >= 40
             else "persistent and unresolved" if g <= 5 else f"growing (+{g:.0f}% / 7d)")
    return (f"{sev} severity: {cluster.get('cases', 0)} consumers affected by the same "
            f"pattern at {firm}{' and others' if len(comp) > 1 else ''}, and it is {trend}. "
            f"Left unaddressed it risks foreseeable harm at scale before any individual "
            f"complaint is resolved.")


def _consumer_duty(cluster: Dict) -> List[Dict]:
    sigs = cluster.get("matched_signals") or []
    seen, out = set(), []
    for s in sigs:
        if s in SIGNAL_TO_DUTY:
            key, why = SIGNAL_TO_DUTY[s]
            if key not in seen:
                seen.add(key)
                out.append({"outcome": DUTY[key], "rationale": why})
    if not out:  # default: products & services + cross-cutting harm
        out.append({"outcome": DUTY["products"],
                    "rationale": "Repeated automated detriment calls into question "
                                 "whether the journey is designed to deliver good outcomes "
                                 "(cross-cutting duty to avoid foreseeable harm)."})
    return out


def _hypotheses(cluster: Dict) -> List[Dict]:
    cat = cluster.get("category", "Other")
    ctx = _ctx_text(cluster)
    # Strength of the automation evidence, in [0,1]: how many distinct implied
    # signals / explicit keywords the cluster carries. Replaces the old
    # ai_confidence lift (every cluster here is already confirmed AI-related).
    n_sig = len(cluster.get("matched_signals") or [])
    n_kw = 1 if (cluster.get("matched_keywords") or []) else 0
    sig_strength = min(n_sig + n_kw, 4) / 4.0
    templates = CATEGORY_MECHANISMS.get(cat, [(
        "A recently deployed or changed automated decisioning process appears to "
        "be producing the recurring detriment seen in these complaints.",
        0.4, "repeating automated-handling cues", [])])

    out = []
    for mech, base, ev_hint, ctx_kw in templates:
        support = sum(1 for k in ctx_kw if k in ctx)
        # Likelihood: base, lifted by evidence strength and contextual support, capped <1.
        lk = base + 0.25 * sig_strength + min(support, 3) * 0.05
        lk = round(min(lk, 0.9), 2)
        firms = ", ".join((cluster.get("companies") or [])[:3]) or "the affected firms"
        evidence = (f"{cluster.get('cases', 0)} complaints showing {ev_hint}; "
                    f"concentrated at {firms}.")
        out.append({"mechanism": mech, "likelihood": lk, "evidence": evidence})

    # Discrimination escalator.
    if any(h in ctx for h in DISCRIMINATION_HINTS) or cat in ("Insurance", "Consumer Credit"):
        out.append({
            "mechanism": "If the automated model relies on variables that act as "
                         "proxies for protected characteristics (e.g. postcode, name), "
                         "outcomes may be indirectly discriminatory even without intent.",
            "likelihood": round(min(0.35 + 0.2 * sig_strength, 0.6), 2),
            "evidence": "Category is exposed to proxy-based discrimination; decisions "
                        "issued without reasons make disparate impact hard to detect.",
        })
    return sorted(out, key=lambda h: h["likelihood"], reverse=True)[:3]


def _actions(cluster: Dict) -> List[Dict]:
    sigs = set(cluster.get("matched_signals") or [])
    cat = cluster.get("category", "Other")
    ctx = _ctx_text(cluster)
    firm = (cluster.get("companies") or ["the firm"])[0]
    actions = [
        {"action": f"Issue a formal information request to {firm} for documentation of "
                   f"any automated decisioning model in this journey — model purpose, "
                   f"version/change log over the affected period, validation reports, and "
                   f"decline/false-positive/exit-rate metrics.",
         "basis": "FSMA 2000 s.165 (power to require information)"},
        {"action": f"Ask {firm} directly: did you deploy or materially change an "
                   f"automated {('monitoring' if cat in ('Banking','Cards & Payments','Payments & Crypto') else 'decisioning')} "
                   f"model in the last 6–12 months, and what consumer-outcome testing "
                   f"preceded it?",
         "basis": "Supervisory enquiry under Principle 11 (open & cooperative)"},
        {"action": "Require a Consumer Duty outcomes assessment for the affected journey, "
                   "evidencing that customers receive good outcomes and fair value.",
         "basis": "PRIN 2A (Consumer Duty) / Principle 12"},
    ]
    if {"no_human", "loop_runaround", "action_without_notice"} & sigs:
        actions.append({
            "action": "Require reinstatement of a human-review and escalation path before "
                      "automated adverse actions take effect, and clear, specific reasons "
                      "plus an accessible appeal route for affected customers.",
            "basis": "Consumer Duty — Consumer Support & Understanding outcomes"})
    if cat in ("Insurance", "Consumer Credit") or any(h in ctx for h in DISCRIMINATION_HINTS):
        actions.append({
            "action": "Require a disparate-impact / Equality Act impact assessment of the "
                      "model across protected groups, with evidence the firm tests for and "
                      "mitigates proxy discrimination.",
            "basis": "Equality Act 2010 + Consumer Duty (avoid foreseeable harm)"})
    if cluster.get("severity_band") == "CRITICAL":
        actions.append({
            "action": "Consider commissioning a Skilled Person review of the firm's "
                      "automated-decisioning governance and oversight.",
            "basis": "FSMA 2000 s.166 (skilled persons report)"})
    return actions


def _assess_rules(cluster: Dict) -> Dict:
    return {
        "why_concerning": _why_concerning(cluster),
        "ai_rationale": _ai_rationale(cluster),
        "consumer_duty": _consumer_duty(cluster),
        "hypotheses": _hypotheses(cluster),
        "actions": _actions(cluster),
        "generated_by": "rules",
    }


# ---------------------------------------------------------------------------
# LLM backend
# ---------------------------------------------------------------------------

ASSESS_SYSTEM = """You are a senior FCA supervisor analysing a CLUSTER of related \
consumer complaints that an upstream model flagged as AI/automation-related. \
Produce a concise, evidence-grounded supervisory assessment.

Ground every statement in the cluster's category, detection signals, firms, and \
the sample complaint narratives provided. Be precise and proportionate: these are \
HYPOTHESES TO INVESTIGATE, not findings — never assert certainty, and give each \
mechanism a likelihood in [0,1] below 1.

Cover:
- why_concerning: why this pattern warrants supervisory attention (scale, harm, trend).
- ai_rationale: why the harm is plausibly AI/automation-driven (cite the cues).
- consumer_duty: which FCA Consumer Duty outcome(s) are at risk — choose from \
"Consumer Support", "Consumer Understanding", "Products & Services", "Price & Value" \
— each with a one-line rationale.
- hypotheses: 1–3 plausible algorithmic MECHANISMS for how the firm's automation \
could be producing this harm (e.g. a tightened AML model raising false-positive \
account closures; an affordability model using proxies for protected characteristics). \
Each with a likelihood and the evidence it rests on.
- actions: concrete, proportionate supervisory measures with their legal/regulatory \
basis (e.g. FSMA s.165 information request for the model and change log; s.166 \
skilled-person review; Consumer Duty outcomes assessment; Equality Act disparate-\
impact testing; require a human-review/appeal path)."""


def _assess_llm(cluster: Dict) -> Dict:
    import anthropic
    from pydantic import BaseModel, Field

    class DutyItem(BaseModel):
        outcome: str
        rationale: str

    class Hypothesis(BaseModel):
        mechanism: str
        likelihood: float = Field(description="0..1, strictly below 1")
        evidence: str

    class Action(BaseModel):
        action: str
        basis: str = Field(description="legal/regulatory basis")

    class Assessment(BaseModel):
        why_concerning: str
        ai_rationale: str
        consumer_duty: List[DutyItem]
        hypotheses: List[Hypothesis]
        actions: List[Action]

    client = anthropic.Anthropic()
    samples = "\n".join(f"- {n}" for n in (cluster.get("sample_narratives") or [])[:3])
    user = (
        f"Cluster: {cluster.get('name')}\n"
        f"Category: {cluster.get('category')}\n"
        f"Cases: {cluster.get('cases')} | Severity: {cluster.get('severity_band')} | "
        f"7d growth: {cluster.get('growth_7d')}%\n"
        f"Firms: {', '.join(cluster.get('companies') or [])}\n"
        f"Explicit keywords: {', '.join(cluster.get('matched_keywords') or []) or '(none)'}\n"
        f"Implied signals: {', '.join(cluster.get('matched_signals') or []) or '(none)'}\n\n"
        f"Sample complaint narratives:\n{samples}"
    )
    resp = client.messages.parse(
        model=LLM_MODEL,
        max_tokens=1400,
        system=[{"type": "text", "text": ASSESS_SYSTEM,
                 "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": user}],
        output_format=Assessment,
    )
    a = resp.parsed_output
    if a is None:
        out = _assess_rules(cluster)
        out["generated_by"] = "rules (llm-fallback)"
        return out
    d = a.model_dump()
    d["generated_by"] = "llm"
    # Clamp likelihoods < 1.
    for h in d.get("hypotheses", []):
        h["likelihood"] = round(min(max(float(h["likelihood"]), 0.0), 0.95), 2)
    return d


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def assess_clusters(clusters: List[Dict], backend: str = "auto",
                    max_clusters: int = 0) -> List[Dict]:
    """
    Attach an `assessment` dict to each cluster in place and return the list.
    `max_clusters` caps the LLM backend (0 = all); rules backend assesses all.
    """
    if not clusters:
        return clusters

    chosen = backend
    if backend == "auto":
        chosen = "llm" if os.environ.get("ANTHROPIC_API_KEY") else "rules"
        if chosen == "rules":
            logger.info("No ANTHROPIC_API_KEY — using rule-based supervisory assessment.")

    use_llm = chosen == "llm"
    for i, c in enumerate(clusters):
        if use_llm and (not max_clusters or i < max_clusters):
            try:
                c["assessment"] = _assess_llm(c)
                continue
            except ImportError:
                logger.warning("anthropic SDK missing — rules backend.")
                use_llm = False
            except Exception as exc:  # noqa: BLE001
                logger.warning("LLM assessment failed on %s: %s — rules fallback.",
                               c.get("id"), exc)
        c["assessment"] = _assess_rules(c)

    logger.info("Generated %d supervisory assessments (backend=%s).", len(clusters), chosen)
    return clusters


if __name__ == "__main__":
    import json
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    demo = {
        "id": "CL-007", "name": "Cards & Payments — Closing your account",
        "category": "Cards & Payments", "cases": 29, "severity_band": "CRITICAL",
        "growth_7d": 200, "companies": ["Citibank", "Synchrony"],
        "matched_keywords": ["automated system"],
        "matched_signals": ["no_human", "no_explanation", "action_without_notice"],
        "sample_narratives": ["My account was closed with no explanation and I could "
                              "not reach a human; they said it was flagged as suspicious."],
    }
    print(json.dumps(assess_clusters([demo], backend="rules")[0]["assessment"], indent=2))
