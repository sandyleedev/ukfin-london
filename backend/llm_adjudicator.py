"""
llm_adjudicator.py
==================
STAGE 2 of the ReguTriage two-stage funnel: precision adjudication of the
Stage-1 candidates produced by ai_filter.generate_candidates().

Interchangeable backends:

  • "llm"   — ask Claude, per candidate, whether the complaint genuinely
              involves AI / automation that affected the consumer. Best recall
              on *implied* cases (no human, unexplained denials). Needs
              ANTHROPIC_API_KEY. Uses structured outputs (messages.parse) so the
              verdict is a typed object, and caches the rubric system prompt so
              repeated calls are cheap.

  • "score" — deterministic weighted score over the Stage-1 signals + taxonomy
              likelihood, thresholded. Zero cost, fully auditable, no network.
              The explainable fallback when no API key is present.

  • "gemini" — same per-candidate classification via Google Gemini (JSON
              output). Needs GOOGLE_API_KEY. Routed through llm_providers.

  • "auto"  — pick "llm" when ANTHROPIC_API_KEY is set, else "gemini" when
              GOOGLE_API_KEY is set, else "score".

Both backends add the same columns to the candidate DataFrame:
  - ai_related   : bool   (final verdict)
  - confidence   : float  (0..1)
  - rationale    : str    (one-line justification)
  - adjudicator  : "llm" | "score"

Model selection (llm backend): defaults to claude-opus-4-8. Override with the
REGUTRIAGE_LLM_MODEL env var (e.g. claude-haiku-4-5 for cheaper/faster runs).
"""

import logging
import os
from typing import List

import pandas as pd

logger = logging.getLogger("llm_adjudicator")

# Default to the most capable model; allow override for cost/speed.
LLM_MODEL = os.environ.get("REGUTRIAGE_LLM_MODEL", "claude-opus-4-8")

# Rubric handed to Claude as the (cacheable) system prompt. Written for the
# model: explicit, gradeable criteria for what counts as AI/automation-related.
ADJUDICATION_SYSTEM = """You are a RegTech triage analyst for an FCA-style \
consumer-protection sandbox. For each consumer finance complaint, decide whether \
it genuinely involves AI, automation, or algorithmic decision-making that \
affected the consumer.

Count as AI/automation-related (ai_related = true) when the narrative shows ANY of:
- An explicit automated system, algorithm, model, chatbot, or robo-process.
- An adverse action (denial, account closure, lock, flag) taken automatically or \
with no human review.
- A decision the consumer could not get a human to explain or override (no human \
in the loop, unexplained automated outcome, endless automated loop/runaround).

Do NOT count (ai_related = false) when:
- The complaint is an ordinary dispute (billing error, fraud they report, missing \
payment, rude human agent) with no sign of automation driving the harm.
- "Automated" appears only incidentally (e.g. an automatic payment the consumer set up).
- The narrative is too vague to tell.

Be precise: when in doubt, lean false. Give a confidence in [0,1] and a one-line \
rationale citing the specific cue."""


def _build_user_prompt(row: pd.Series) -> str:
    """Assemble the per-candidate user message (kept short and volatile-last)."""
    kws = ", ".join(row.get("matched_keywords") or []) or "(none)"
    sigs = ", ".join(row.get("matched_signals") or []) or "(none)"
    narrative = str(row.get("consumer_complaint_narrative") or "")
    # Cap narrative length to bound tokens; adjudication rarely needs >2k chars.
    narrative = narrative[:2000]
    return (
        f"Product: {row.get('product')}\n"
        f"Issue: {row.get('issue')}\n"
        f"Stage-1 explicit keywords: {kws}\n"
        f"Stage-1 implied signals: {sigs}\n"
        f"Likelihood tier: {row.get('likelihood_tier')}\n\n"
        f"Complaint narrative:\n\"\"\"\n{narrative}\n\"\"\""
    )


# ---------------------------------------------------------------------------
# Backend: deterministic weighted score
# ---------------------------------------------------------------------------

def _score_row(row: pd.Series) -> tuple:
    """
    Deterministic confidence in [0,1] from Stage-1 signals + likelihood.

    Weights (capped at 1.0):
      explicit keyword present .......... 0.60  (+0.10 per extra, cap +0.20)
      each implied signal ............... 0.25  (cap 0.50)
      likelihood tier high .............. +0.25 ; medium +0.10
    Threshold for ai_related: 0.50.

    Calibration note: Stage 1 already AND-gated implied signals on algorithmic
    context, so a single implied signal in a HIGH-likelihood product/issue
    (0.25 + 0.25 = 0.50) just clears the bar — that's the Tier-2 case we want to
    keep. A single implied signal in only MEDIUM context (0.35) is dropped as
    too weak. The LLM backend resolves these borderline cases far better; the
    deterministic scorer is the auditable, no-key fallback.
    """
    kws = row.get("matched_keywords") or []
    sigs = row.get("matched_signals") or []
    tier = row.get("likelihood_tier")

    score = 0.0
    if kws:
        score += 0.60 + min(len(kws) - 1, 2) * 0.10
    score += min(len(sigs), 2) * 0.25
    score += {"high": 0.25, "medium": 0.10}.get(tier, 0.0)
    score = min(score, 1.0)

    parts = []
    if kws:
        parts.append(f"explicit:{','.join(kws)}")
    if sigs:
        parts.append(f"implied:{','.join(sigs)}")
    parts.append(f"likelihood:{tier}")
    rationale = "score=%.2f (%s)" % (score, "; ".join(parts))
    return (score >= 0.50), round(score, 2), rationale


def _adjudicate_score(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    results = out.apply(_score_row, axis=1)
    out["ai_related"] = [r[0] for r in results]
    out["confidence"] = [r[1] for r in results]
    out["rationale"] = [r[2] for r in results]
    out["adjudicator"] = "score"
    logger.info("Deterministic adjudication: %d/%d confirmed AI-related.",
                int(out["ai_related"].sum()), len(out))
    return out


# ---------------------------------------------------------------------------
# Backend: LLM (Claude) adjudication
# ---------------------------------------------------------------------------

def _adjudicate_llm(df: pd.DataFrame, max_candidates: int) -> pd.DataFrame:
    """
    Per-candidate Claude classification with structured outputs.

    Uses the Pydantic-typed `.parse()` helper, an adaptive-thinking-free call
    (this is a constrained classification, so no thinking needed), and prompt
    caching on the rubric system prompt so each call only pays full price for
    the short per-row user message.
    """
    import anthropic
    from pydantic import BaseModel, Field

    class Verdict(BaseModel):
        ai_related: bool = Field(description="True if the complaint genuinely "
                                             "involves AI/automation harm.")
        confidence: float = Field(description="Confidence in [0,1].")
        rationale: str = Field(description="One-line justification citing the cue.")

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

    out = df.copy()
    if max_candidates and len(out) > max_candidates:
        logger.info("Capping LLM adjudication at %d of %d candidates.",
                    max_candidates, len(out))
        out = out.head(max_candidates).copy()

    verdicts: List[dict] = []
    for i, (_, row) in enumerate(out.iterrows(), start=1):
        try:
            resp = client.messages.parse(
                model=LLM_MODEL,
                max_tokens=512,
                # Cache the rubric (stable prefix) so repeated calls are cheap.
                system=[{
                    "type": "text",
                    "text": ADJUDICATION_SYSTEM,
                    "cache_control": {"type": "ephemeral"},
                }],
                messages=[{"role": "user", "content": _build_user_prompt(row)}],
                output_format=Verdict,
            )
            v = resp.parsed_output
            if v is None:  # refusal / schema miss — fail safe to not-AI, low conf
                verdicts.append({"ai_related": False, "confidence": 0.0,
                                 "rationale": "llm: no parseable verdict"})
            else:
                verdicts.append({
                    "ai_related": bool(v.ai_related),
                    "confidence": float(max(0.0, min(1.0, v.confidence))),
                    "rationale": "llm: " + v.rationale.strip(),
                })
        except Exception as exc:  # noqa: BLE001 - keep the batch going
            logger.warning("LLM adjudication failed on row %d: %s", i, exc)
            verdicts.append({"ai_related": False, "confidence": 0.0,
                             "rationale": f"llm error: {exc}"})

        if i % 25 == 0:
            logger.info("  adjudicated %d/%d ...", i, len(out))

    out["ai_related"] = [v["ai_related"] for v in verdicts]
    out["confidence"] = [round(v["confidence"], 2) for v in verdicts]
    out["rationale"] = [v["rationale"] for v in verdicts]
    out["adjudicator"] = "llm"
    logger.info("LLM adjudication: %d/%d confirmed AI-related (model=%s).",
                int(out["ai_related"].sum()), len(out), LLM_MODEL)
    return out


# ---------------------------------------------------------------------------
# Backend: Gemini adjudication
# ---------------------------------------------------------------------------

def _gemini_batch_prompt(rows) -> str:
    """Build one prompt classifying a batch of candidates, indexed 0..N-1."""
    lines = []
    for i, (_, row) in enumerate(rows):
        kws = ", ".join(row.get("matched_keywords") or []) or "(none)"
        sigs = ", ".join(row.get("matched_signals") or []) or "(none)"
        narrative = str(row.get("consumer_complaint_narrative") or "")[:700]
        lines.append(
            f"[{i}] product={row.get('product')} | issue={row.get('issue')} | "
            f"keywords={kws} | signals={sigs} | likelihood={row.get('likelihood_tier')}\n"
            f"narrative: \"{narrative}\""
        )
    body = "\n\n".join(lines)
    return (
        "Classify EACH complaint below. For every item return its index i, a "
        "boolean ai_related, and a confidence in [0,1]. Return exactly one entry "
        "per item, using the item's own index.\n\n" + body
    )


_VERDICT_CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                              "output", "gemini_verdicts.json")


def _load_verdict_cache() -> dict:
    import json
    try:
        with open(_VERDICT_CACHE, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def _save_verdict_cache(cache: dict) -> None:
    import json
    os.makedirs(os.path.dirname(_VERDICT_CACHE), exist_ok=True)
    with open(_VERDICT_CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh)


def _adjudicate_gemini(df: pd.DataFrame, max_candidates: int) -> pd.DataFrame:
    """Google Gemini classification, BATCHED and RESUMABLE.

    Each candidate's verdict is cached to output/gemini_verdicts.json keyed by
    complaint_id, and saved after every batch. So if the free-tier key 429s
    mid-build, progress is kept — re-running only adjudicates the candidates that
    aren't cached yet, until the whole set is done. Rows still missing at the end
    of a run fall back to the deterministic scorer so a partial build is sane.
    """
    import time
    import llm_providers

    if not llm_providers.have_google():
        logger.warning("No GOOGLE_API_KEY — falling back to score backend.")
        return _adjudicate_score(df)

    out = df.copy()
    if max_candidates and len(out) > max_candidates:
        logger.info("Capping Gemini adjudication at %d of %d candidates.",
                    max_candidates, len(out))
        out = out.head(max_candidates).copy()

    batch = int(os.environ.get("GEMINI_ADJ_BATCH", "40"))
    throttle = float(os.environ.get("GEMINI_ADJ_THROTTLE", "0"))
    system = ADJUDICATION_SYSTEM
    cache = _load_verdict_cache()

    rows = list(out.iterrows())
    # Only call Gemini for candidates we don't already have a cached verdict for.
    pending = [(idx, row) for idx, row in rows
               if str(row.get("complaint_id")) not in cache]
    logger.info("Gemini adjudication: %d cached, %d pending (of %d).",
                len(rows) - len(pending), len(pending), len(rows))

    # GEMINI_NO_FETCH=1 → assemble from the cache only (no API calls); pending
    # rows use the deterministic fallback. Lets us build a snapshot instantly
    # from whatever's cached when the daily quota is spent.
    if os.environ.get("GEMINI_NO_FETCH") == "1":
        pending = []

    for start in range(0, len(pending), batch):
        chunk = pending[start:start + batch]
        result = llm_providers.gemini_classify_batch(system, _gemini_batch_prompt(chunk),
                                                     max_tokens=8192)
        parsed = {}
        if isinstance(result, list):
            for v in result:
                try:
                    parsed[int(v["i"])] = v
                except (KeyError, TypeError, ValueError):
                    continue
        got = 0
        for j in range(len(chunk)):
            v = parsed.get(j)
            if not v:
                continue  # leave uncached so a later run retries it
            cid = str(chunk[j][1].get("complaint_id"))
            cache[cid] = {
                "ai_related": bool(v.get("ai_related", False)),
                "confidence": float(max(0.0, min(1.0, v.get("confidence", 0.0) or 0.0))),
            }
            got += 1
        if got:
            _save_verdict_cache(cache)  # persist progress after every batch
        logger.info("  gemini batch %d-%d: cached %d/%d (total cached %d/%d)",
                    start, start + len(chunk), got, len(chunk),
                    sum(1 for _, r in rows if str(r.get("complaint_id")) in cache), len(rows))
        if throttle:
            time.sleep(throttle)

    # Assemble verdicts: cached (gemini) where present, deterministic fallback else.
    ai, conf, rat = [], [], []
    n_fallback = 0
    for _, row in rows:
        cid = str(row.get("complaint_id"))
        cv = cache.get(cid)
        if cv:
            ai.append(bool(cv["ai_related"]))
            conf.append(round(float(cv["confidence"]), 2))
            rat.append("gemini")
        else:
            ok, sc, _ = _score_row(row)
            ai.append(ok); conf.append(sc); rat.append("score (gemini pending)")
            n_fallback += 1

    out["ai_related"] = ai
    out["confidence"] = conf
    out["rationale"] = rat
    out["adjudicator"] = "gemini"
    logger.info("Gemini adjudication: %d/%d confirmed AI-related (%d still pending "
                "→ score fallback; re-run to complete).",
                int(sum(ai)), len(out), n_fallback)
    return out


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def adjudicate(candidates: pd.DataFrame, backend: str = "auto",
               max_candidates: int = 0) -> pd.DataFrame:
    """
    Run Stage-2 adjudication over Stage-1 candidates.

    backend: "auto" | "llm" (Claude) | "gemini" | "score".
      auto → llm if ANTHROPIC_API_KEY, else gemini if GOOGLE_API_KEY, else score.
    max_candidates: cap for the LLM backends (0 = no cap). Ignored by score.

    Returns the candidate DataFrame with ai_related/confidence/rationale/
    adjudicator columns added. The caller typically filters to ai_related=True.
    """
    if candidates is None or candidates.empty:
        return pd.DataFrame()

    chosen = backend
    if backend == "auto":
        if os.environ.get("ANTHROPIC_API_KEY"):
            chosen = "llm"
        elif os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"):
            chosen = "gemini"
        else:
            chosen = "score"
            logger.info("No LLM key found — using deterministic score backend "
                        "(set ANTHROPIC_API_KEY or GOOGLE_API_KEY to enable LLM).")

    if chosen == "llm":
        try:
            return _adjudicate_llm(candidates, max_candidates)
        except ImportError:
            logger.warning("anthropic SDK not installed — falling back to score.")
            return _adjudicate_score(candidates)
    if chosen == "gemini":
        return _adjudicate_gemini(candidates, max_candidates)
    return _adjudicate_score(candidates)


if __name__ == "__main__":
    # Self-test the deterministic backend (no network/key needed).
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    demo = pd.DataFrame([
        {"consumer_complaint_narrative": "An algorithm denied my loan.",
         "product": "Credit card", "issue": "Denied",
         "matched_keywords": ["algorithm"], "matched_signals": [],
         "likelihood_tier": "high"},
        {"consumer_complaint_narrative": "Closed my account without notice and "
                                         "I could not reach a human.",
         "product": "Checking or savings account", "issue": "Closing an account",
         "matched_keywords": [], "matched_signals": ["no_human", "action_without_notice"],
         "likelihood_tier": "high"},
        {"consumer_complaint_narrative": "The agent was rude.",
         "product": "Mortgage", "issue": "Trouble during payment process",
         "matched_keywords": [], "matched_signals": [], "likelihood_tier": "low"},
    ])
    res = adjudicate(demo, backend="score")
    print(res[["ai_related", "confidence", "rationale"]].to_string())
