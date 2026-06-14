"""
ai_filter.py
============
Precision regex filter that keeps only complaints whose narrative mentions
AI / automation. Matching is done *only* against the
`consumer_complaint_narrative` field, case-insensitive.

Why regex over a fuzzy / ML approach for the MVP:
- Deterministic and auditable (regulators care about explainability).
- Fast over hundreds of thousands of rows.
- Word-boundary anchoring lets us avoid obvious false positives like
  "glitchy marketing copy" while still catching the phrases we want.
"""

import logging
import re
from typing import Dict, List

import pandas as pd

logger = logging.getLogger("ai_filter")

# ---------------------------------------------------------------------------
# Keyword matrix
# ---------------------------------------------------------------------------
# Each entry maps a canonical keyword label -> a regex fragment.
#
# Boundary strategy:
#   * Single "noisy" words (glitch, algorithm, chatbot) get \b...\b anchors so
#     "glitch" matches but "glitchy" does not, and "bot" inside "robot" is not
#     mistaken for "chat bot".
#   * Multi-word phrases ("automated system") are already specific enough that
#     a leading/trailing \b is sufficient.
#   * Alternates that the spec calls out (roboadvisor / robo-advisor,
#     chatbot / chat bot) are folded into a single fragment with optional
#     separators so they map back to ONE canonical label.
#
# The canonical label is what we record in `matched_keywords`, so a complaint
# that says "chat bot" reports the keyword "chatbot" — keeping stats clean.

KEYWORD_PATTERNS: Dict[str, str] = {
    "algorithm": r"\balgorithm\b",
    "automated system": r"\bautomated system\b",
    "computer error": r"\bcomputer error\b",
    "automated loop": r"\bautomated loop\b",
    # robo-advisor / roboadvisor / robo advisor
    "robo-advisor": r"\brobo[\s-]?advisor\b",
    "artificial intelligence": r"\bartificial intelligence\b",
    # chatbot / chat bot
    "chatbot": r"\bchat\s?bot\b",
    "bot denied": r"\bbot denied\b",
    # \bglitch\b avoids "glitchy" per the spec. NOTE: "glitch" is a SOFT keyword
    # (see SOFT_KEYWORDS below) — it's recorded for transparency but, on its own,
    # does NOT qualify a complaint as a Stage-1 candidate. Consumers use "glitch"
    # casually ("I refreshed my browser thinking it was a glitch"), so a lone
    # match is overwhelmingly noise; a genuine automation glitch also carries an
    # implied signal (no human, no explanation) or another keyword.
    "glitch": r"\bglitch\b",
    "pricing anomaly": r"\bpricing anomaly\b",
    "automated decision": r"\bautomated decision\b",
}

# Keywords too ambiguous to confirm AI/automation on their own. They are still
# recorded in matched_keywords, but generate_candidates does not treat them as a
# Tier-1 explicit hit (see has_explicit). "glitch" is the canonical example:
# overwhelmingly used casually by consumers, not to describe an automated system.
SOFT_KEYWORDS = {"glitch"}

# Pre-compile each label's pattern individually (IGNORECASE). We keep them
# separate rather than one giant alternation so that, per matched row, we can
# cheaply report *which* labels fired without re-running a combined regex and
# mapping capture groups back to labels.
_COMPILED: Dict[str, re.Pattern] = {
    label: re.compile(pattern, re.IGNORECASE)
    for label, pattern in KEYWORD_PATTERNS.items()
}

# A single combined pattern is also handy for a fast "does this match anything
# at all?" pre-check before the per-label loop. Wrapped in a non-capturing
# group alternation.
_COMBINED = re.compile(
    "|".join(f"(?:{p})" for p in KEYWORD_PATTERNS.values()),
    re.IGNORECASE,
)


def _matched_labels(narrative: str) -> List[str]:
    """
    Return the list of canonical keyword labels that appear in `narrative`.
    Uses the fast combined regex as a gate, then the per-label patterns to
    attribute the hits.
    """
    if not _COMBINED.search(narrative):
        return []
    return [label for label, pat in _COMPILED.items() if pat.search(narrative)]


def filter_ai_complaints(complaints) -> pd.DataFrame:
    """
    Filter a list of complaint dicts (or an existing DataFrame) down to only
    AI/automation-related complaints.

    Steps:
      1. Build / accept a DataFrame.
      2. Drop rows with null / empty / whitespace-only / NaN narratives.
      3. Run the regex matcher on each narrative.
      4. Keep only rows with >=1 matched keyword, adding `matched_keywords`.

    Returns the filtered DataFrame (may be empty).
    """
    # Accept either a list of dicts or a ready DataFrame.
    df = complaints if isinstance(complaints, pd.DataFrame) else pd.DataFrame(complaints)

    if df.empty or "consumer_complaint_narrative" not in df.columns:
        logger.warning("No data or missing narrative column; nothing to filter.")
        return pd.DataFrame(columns=list(df.columns) + ["matched_keywords"])

    total_in = len(df)

    # --- Drop empty narratives -------------------------------------------
    # Coerce to string-safe: NaN -> drop. We treat empty and whitespace-only
    # strings as "no narrative" too.
    narrative = df["consumer_complaint_narrative"]
    mask_has_narrative = (
        narrative.notna()
        & narrative.astype(str).str.strip().ne("")
        # Some CCDB rows use literal "None"/"nan" strings; exclude those.
        & ~narrative.astype(str).str.strip().str.lower().isin(["none", "nan", "null"])
    )
    df = df.loc[mask_has_narrative].copy()
    logger.info(
        "Dropped %d rows with empty/null narrative (%d remain).",
        total_in - len(df), len(df),
    )

    if df.empty:
        return df.assign(matched_keywords=pd.Series(dtype=object))

    # --- Run the matcher --------------------------------------------------
    df["matched_keywords"] = df["consumer_complaint_narrative"].astype(str).apply(
        _matched_labels
    )

    # Keep only rows that matched at least one keyword.
    matched = df[df["matched_keywords"].map(len) > 0].copy()

    logger.info(
        "AI filter matched %d of %d narrative-bearing complaints.",
        len(matched), len(df),
    )
    return matched


def get_match_stats(df: pd.DataFrame) -> Dict[str, int]:
    """
    Return a dict of keyword -> number of complaints that triggered it,
    sorted descending by hit count. A complaint matching several keywords
    counts once toward each.
    """
    counts: Dict[str, int] = {label: 0 for label in KEYWORD_PATTERNS}

    if df is None or df.empty or "matched_keywords" not in df.columns:
        return {}

    for kw_list in df["matched_keywords"]:
        for kw in kw_list or []:
            counts[kw] = counts.get(kw, 0) + 1

    # Drop zero-hit keywords and sort by count desc for readable reporting.
    nonzero = {k: v for k, v in counts.items() if v > 0}
    return dict(sorted(nonzero.items(), key=lambda kv: kv[1], reverse=True))


# ===========================================================================
# STAGE 1 — Two-signal candidate generation (high recall)
# ===========================================================================
# The explicit keyword filter above is high-precision / low-recall: it only
# catches complaints that *name* the technology. Many AI/automation harms show
# up as IMPLIED signals instead ("denied with no explanation", "couldn't reach
# a human"). To raise recall without flooding, we combine two signals:
#
#   keep_candidate if:
#       explicit_keyword                       (Tier 1, high confidence)
#    OR (algo_context AND implied_signal)      (Tier 2, medium confidence)
#
# `algo_context` is the taxonomy "likelihood" dimension: is this a product /
# issue where algorithmic intervention is common? It is used as an AND-gate on
# the weak implied signals — NOT as a standalone OR branch (which would pull in
# entire product categories and destroy precision).
# ---------------------------------------------------------------------------

# --- Implied-signal patterns (weaker; gated by algo_context) ---------------
# These describe automation symptoms without naming the tech: no human in the
# loop, unexplained automated actions, being stuck in a loop.
IMPLIED_SIGNAL_PATTERNS: Dict[str, str] = {
    # Can't reach a human / no human in the loop.
    "no_human": (
        r"\b(?:can(?:'?t|not)|could\s*n'?t|could\s+not|unable\s+to|never\s+(?:could|able))"
        r"\s+(?:reach|speak\s+(?:to|with)|talk\s+(?:to|with)|get\s+(?:a|to)|connect\s+(?:to|with))"
        r"\s+(?:a\s+|an\s+)?(?:real\s+|live\s+|actual\s+)?(?:human|person|representative|rep|agent|someone)\b"
        r"|\bno\s+(?:one|human|person|live\s+agent|way\s+to\s+(?:reach|speak|talk))\b"
        r"|\bnever\s+(?:reached|spoke\s+to|talked\s+to|got)\s+(?:a\s+)?(?:human|person|representative)\b"
    ),
    # Automated adverse action: auto-denied / auto-closed / auto-flagged.
    "auto_adverse_action": (
        r"\b(?:automatically|automated(?:ly)?|the\s+system)\s+"
        r"(?:denied|declined|rejected|closed|locked|froze|frozen|flagged|suspended|restricted|cancel(?:l?ed)?)\b"
        r"|\b(?:denied|declined|rejected|closed|locked|flagged)\s+(?:automatically|by\s+(?:the\s+)?system|by\s+a\s+computer)\b"
    ),
    # Decision with no human-readable explanation.
    "no_explanation": (
        r"\b(?:no|without|never\s+(?:given|provided)\s+(?:a|any))\s+"
        r"(?:explanation|reason|justification|rationale)\b"
        r"|\bunexplained\b"
        r"|\bno\s+reason\s+(?:was\s+)?(?:given|provided|stated)\b"
    ),
    # Account/card actioned without notice or reason.
    "action_without_notice": (
        r"\b(?:account|card)\s+(?:was\s+|were\s+|got\s+)?"
        r"(?:closed|locked|frozen|suspended|restricted|cancel(?:l?ed)?)\s+"
        r"(?:without|with\s+no)\s+(?:notice|warning|reason|explanation)\b"
    ),
    # Stuck in a loop / endless transfers / runaround.
    "loop_runaround": (
        r"\bkept\s+(?:transferring|redirecting|bouncing|sending|getting\s+(?:transferred|redirected))\b"
        r"|\b(?:stuck|trapped|caught)\s+in\s+a\s+(?:loop|cycle|endless\s+loop)\b"
        r"|\brun[\s-]?around\b"
        r"|\bendless(?:ly)?\s+(?:loop|transfer)"
    ),
}

_IMPLIED_COMPILED: Dict[str, re.Pattern] = {
    label: re.compile(pattern, re.IGNORECASE)
    for label, pattern in IMPLIED_SIGNAL_PATTERNS.items()
}

# --- Likelihood taxonomy (algorithmic-intervention context) ----------------
# Products where automated decisioning / fraud models / e-OSCAR dispute
# automation / robo-processing are common. Matched case-insensitively as a
# substring so we tolerate the API's verbose product labels.
HIGH_LIKELIHOOD_PRODUCTS = [
    "credit reporting",
    "credit card",
    "prepaid card",
    "checking or savings",
    "money transfer",
    "virtual currency",
    "payday loan",
    "personal loan",
]

# Issue phrases that signal an algorithmic decision/process regardless of product
# (automated dispute investigations, automated adverse actions, fraud models).
HIGH_LIKELIHOOD_ISSUE_RE = re.compile(
    r"investigation"
    r"|incorrect\s+information"
    r"|den(?:y|ied|ial)"
    r"|decline"
    r"|fraud"
    r"|closing\s+(?:your\s+)?account|closed\s+(?:your\s+)?account|account\s+clos"
    r"|credit\s+decision|underwrit|credit\s+score|approval",
    re.IGNORECASE,
)


def _likelihood(product, issue) -> tuple:
    """
    Return (tier, algo_context) for a complaint.

    tier in {"high","medium","low"} is for reporting/sorting; algo_context is the
    boolean AND-gate used by the candidate rule (True when there is *any*
    algorithmic-intervention signal — product OR issue).
    """
    p = str(product or "").lower()
    prod_hit = any(key in p for key in HIGH_LIKELIHOOD_PRODUCTS)
    issue_hit = bool(HIGH_LIKELIHOOD_ISSUE_RE.search(str(issue or "")))

    if prod_hit and issue_hit:
        tier = "high"
    elif prod_hit or issue_hit:
        tier = "medium"
    else:
        tier = "low"
    return tier, (prod_hit or issue_hit)


def _implied_labels(narrative: str) -> List[str]:
    """Return implied-signal labels present in the narrative."""
    return [label for label, pat in _IMPLIED_COMPILED.items() if pat.search(narrative)]


def generate_candidates(complaints) -> pd.DataFrame:
    """
    STAGE 1: high-recall candidate generation using the two-signal rule.

    Adds these columns to each kept row:
      - matched_keywords    : explicit AI/automation terms that fired
      - matched_signals     : implied-automation signals that fired
      - likelihood_tier     : high | medium | low (taxonomy context)
      - candidate_reason    : "explicit_keyword" | "context+implied"
      - stage1_confidence   : "high" (explicit) | "medium" (context+implied)

    A complaint is kept as a candidate when:
        explicit keyword present
     OR (algorithmic-intervention context AND >=1 implied signal)

    Returns the candidate DataFrame (may be empty). Stage 2 adjudication
    (llm_adjudicator) is expected to confirm/reject these candidates.
    """
    df = complaints if isinstance(complaints, pd.DataFrame) else pd.DataFrame(complaints)

    if df.empty or "consumer_complaint_narrative" not in df.columns:
        logger.warning("No data or missing narrative column; no candidates.")
        return pd.DataFrame()

    total_in = len(df)

    # Drop empty narratives (same rule as the explicit filter).
    narrative = df["consumer_complaint_narrative"]
    mask = (
        narrative.notna()
        & narrative.astype(str).str.strip().ne("")
        & ~narrative.astype(str).str.strip().str.lower().isin(["none", "nan", "null"])
    )
    df = df.loc[mask].copy()
    logger.info("Stage1: %d narrative-bearing rows (dropped %d).",
                len(df), total_in - len(df))
    if df.empty:
        return df

    narr = df["consumer_complaint_narrative"].astype(str)
    df["matched_keywords"] = narr.apply(_matched_labels)
    df["matched_signals"] = narr.apply(_implied_labels)

    likelihood = df.apply(lambda r: _likelihood(r.get("product"), r.get("issue")), axis=1)
    df["likelihood_tier"] = [t for t, _ in likelihood]
    algo_context = pd.Series([ctx for _, ctx in likelihood], index=df.index)

    # "Soft" keywords are too ambiguous to qualify a complaint on their own; they
    # only count when corroborated (another keyword, or the Tier-2 path). This
    # keeps them in matched_keywords for transparency while stopping a lone,
    # casual "glitch" from being treated as a confirmed automation signal.
    has_explicit = df["matched_keywords"].apply(
        lambda ks: any(k not in SOFT_KEYWORDS for k in (ks or []))
    )
    has_implied = df["matched_signals"].map(len) > 0
    tier2 = algo_context & has_implied

    keep = has_explicit | tier2
    out = df.loc[keep].copy()

    # Confidence/reason: explicit always wins (high); pure tier-2 is medium.
    out["stage1_confidence"] = ["high" if hk else "medium"
                                for hk in has_explicit.loc[keep]]
    out["candidate_reason"] = ["explicit_keyword" if hk else "context+implied"
                               for hk in has_explicit.loc[keep]]

    logger.info(
        "Stage1 candidates: %d (explicit=%d, context+implied-only=%d) of %d.",
        len(out), int(has_explicit.sum()), int((tier2 & ~has_explicit).sum()), len(df),
    )
    return out


def get_candidate_stats(df: pd.DataFrame) -> Dict[str, Dict[str, int]]:
    """Summary stats for a candidate DataFrame: keyword/signal/tier/confidence counts."""
    if df is None or df.empty:
        return {}

    def _counts(col):
        c: Dict[str, int] = {}
        for items in df.get(col, []):
            for it in (items or []):
                c[it] = c.get(it, 0) + 1
        return dict(sorted(c.items(), key=lambda kv: kv[1], reverse=True))

    def _vc(col):  # value_counts -> plain {str: int} (no numpy int64, JSON-safe)
        if col not in df:
            return {}
        return {str(k): int(v) for k, v in df[col].value_counts().items()}

    return {
        "keywords": _counts("matched_keywords"),
        "signals": _counts("matched_signals"),
        "likelihood_tier": _vc("likelihood_tier"),
        "stage1_confidence": _vc("stage1_confidence"),
    }


if __name__ == "__main__":
    # Tiny self-test exercising boundary behavior.
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    samples = [
        {"consumer_complaint_narrative": "The algorithm denied my loan automatically."},
        {"consumer_complaint_narrative": "Everything was glitchy but fine."},  # no \bglitch\b
        {"consumer_complaint_narrative": "A chat bot kept looping me."},
        {"consumer_complaint_narrative": ""},  # dropped
        {"consumer_complaint_narrative": None},  # dropped
        {"consumer_complaint_narrative": "Their robo advisor made a pricing anomaly."},
    ]
    out = filter_ai_complaints(samples)
    print(out[["consumer_complaint_narrative", "matched_keywords"]].to_string())
    print("Stats:", get_match_stats(out))
