"""
scoring.py — ReguLens Stage 4: turn clusters into a prioritised supervision
queue, plus the live-alert feed and the alert-volume trend that drive the
dashboard.

The priority score is a transparent weighted sum (a "typical weight" a
regulator can inspect and re-tune), combining the dimensions from the workflow:

    priority = w_freq · frequency        (how many consumers affected)
             + w_sev  · severity         (how bad the harm is)
             + w_grow · growth           (how fast it's accelerating — catch it early)
             + w_reg  · regulatory_relevance  (how much it matters to the FCA's remit)

All dimensions are normalised to [0,1] before weighting, so the weights are
directly comparable. Defaults below are the "typical" starting weights; expose
them in the API so the regulator can adjust the balance.

Note: every cluster reaching this stage has already been confirmed
AI/automation-related by Stages 1–2, so "AI confidence" is not a priority
dimension — it would only ask "how AI is this already-AI cluster?" and double-
count signals that already feed severity.
"""

import logging
from datetime import datetime
from typing import Dict, List

logger = logging.getLogger("scoring")

# Typical starting weights (sum = 1.0). Tunable.
DEFAULT_WEIGHTS = {
    "frequency": 0.28,
    "severity": 0.33,
    "growth": 0.22,
    "regulatory_relevance": 0.17,
}

# Minimum cases before a cluster can raise a spike/escalation/triage alert, so a
# single brand-new complaint (growth_7d = +100% "all new") can't masquerade as a
# critical spike.
MIN_ALERT_CASES = 5

# Regulatory-relevance prior by category: where consumer detriment is most
# acute / most central to FCA conduct supervision. 0..1.
REG_RELEVANCE = {
    "Mortgages": 0.95,
    "Pensions": 0.95,
    "Consumer Credit": 0.85,
    "Payments & Crypto": 0.85,
    "Insurance": 0.80,
    "Cards & Payments": 0.75,
    "Banking": 0.70,
    "Auto Lending": 0.65,
    "Debt Collection": 0.70,
    "Credit Reporting": 0.60,
    "Student Lending": 0.70,
    "Other": 0.50,
}

SEVERITY_BANDS = [
    (0.75, "CRITICAL"),
    (0.55, "HIGH"),
    (0.35, "MEDIUM"),
    (0.0, "LOW"),
]


def _severity_score(cluster: Dict, max_cases: int) -> float:
    """
    Composite severity in [0,1]: harm signals + scale + growth.
    Implied no-human / unexplained-denial signals raise severity (the consumer
    can't get recourse), as does a large or fast-growing cluster.
    """
    cases_norm = cluster["cases"] / max_cases if max_cases else 0.0
    growth_norm = min(max(cluster["growth_7d"], 0) / 200.0, 1.0)  # +200% ⇒ 1.0
    # Harmful implied signals indicate the consumer is stuck with no recourse.
    severe_signals = {"no_human", "no_explanation", "action_without_notice"}
    sig_hits = len(set(cluster.get("matched_signals", [])) & severe_signals)
    sig_norm = min(sig_hits / 3.0, 1.0)

    return round(
        0.44 * cases_norm + 0.31 * growth_norm + 0.25 * sig_norm,
        3,
    )


def _severity_band(score: float) -> str:
    for threshold, band in SEVERITY_BANDS:
        if score >= threshold:
            return band
    return "LOW"


def _status(cluster: Dict, as_of: datetime) -> str:
    """ESCALATING / STABLE / SIMMERING / PERSISTENT from growth + age + recency."""
    g = cluster["growth_7d"]
    first = cluster.get("first_seen")
    last = cluster.get("last_activity")
    age_days = (as_of - datetime.fromisoformat(first)).days if first else 0
    idle_days = (as_of - datetime.fromisoformat(last)).days if last else 999

    if g >= 40:
        return "ESCALATING"
    if age_days >= 30 and idle_days <= 14:
        return "PERSISTENT"      # long-lived and still active = entrenched harm
    if g <= 5 and idle_days <= 14:
        return "SIMMERING"       # steady, low-growth, ongoing
    return "STABLE"


def score_clusters(clusters: List[Dict], weights: Dict = None,
                   reg_relevance: Dict = None) -> List[Dict]:
    """
    Annotate each cluster with severity, severity_band, status, priority, and a
    normalised priority_pct, then return them sorted by priority (desc).

    `reg_relevance` optionally overrides the per-category regulatory-relevance
    priors (merged over REG_RELEVANCE), so a customer can tune what matters most.
    """
    if not clusters:
        return []
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    reg_map = {**REG_RELEVANCE, **(reg_relevance or {})}

    max_cases = max(c["cases"] for c in clusters)
    max_growth = max((c["growth_7d"] for c in clusters), default=1) or 1
    as_of_candidates = [datetime.fromisoformat(c["last_activity"])
                        for c in clusters if c.get("last_activity")]
    as_of = max(as_of_candidates) if as_of_candidates else datetime.utcnow()

    for c in clusters:
        sev = _severity_score(c, max_cases)
        freq_norm = c["cases"] / max_cases if max_cases else 0.0
        growth_norm = min(max(c["growth_7d"], 0) / max_growth, 1.0)
        reg = reg_map.get(c["category"], 0.5)

        priority = (
            w["frequency"] * freq_norm
            + w["severity"] * sev
            + w["growth"] * growth_norm
            + w["regulatory_relevance"] * reg
        )
        c["severity"] = sev
        c["severity_band"] = _severity_band(sev)
        c["regulatory_relevance"] = round(reg, 2)
        c["status"] = _status(c, as_of)
        c["priority"] = round(priority, 4)

    ranked = sorted(clusters, key=lambda c: c["priority"], reverse=True)
    top = ranked[0]["priority"] if ranked else 1.0
    for rank, c in enumerate(ranked, start=1):
        c["rank"] = rank
        c["priority_pct"] = round(c["priority"] / top * 100) if top else 0
    return ranked


# ---------------------------------------------------------------------------
# Live alerts
# ---------------------------------------------------------------------------

def build_alerts(clusters: List[Dict]) -> List[Dict]:
    """
    Derive a live-alert feed from cluster dynamics. Alert types mirror the
    workflow's spike / emerging / persistent framing.
    """
    alerts: List[Dict] = []
    for c in clusters:
        last = c.get("last_activity")
        ts = last or datetime.utcnow().isoformat()
        band = c.get("severity_band", "MEDIUM")
        g = c["growth_7d"]

        if g >= 100 and c["cases"] >= MIN_ALERT_CASES:
            alerts.append(_alert(ts, "CRITICAL", "SPIKE",
                                 f"CRITICAL SPIKE: +{g:.0f}% case volume in 7 days — "
                                 f"{c['name']}", c["id"]))
        elif c["status"] == "ESCALATING" and c["cases"] >= MIN_ALERT_CASES:
            alerts.append(_alert(ts, band, "ESCALATING",
                                 f"ESCALATING: {c['name']} growing at +{g:.0f}% / 7d",
                                 c["id"]))
        if c["status"] == "PERSISTENT":
            alerts.append(_alert(ts, band, "SIMMERING",
                                 f"PERSISTENT: {c['name']} active and entrenched",
                                 c["id"]))
        # "New cluster" — first activity within the trailing 7 days.
        first = c.get("first_seen")
        if first and last:
            age = (datetime.fromisoformat(last) - datetime.fromisoformat(first)).days
            if age <= 7 and c["cases"] >= 3:
                alerts.append(_alert(ts, band, "NEW CLUSTER",
                                     f"NEW CLUSTER: {c['name']} pattern detected",
                                     c["id"]))
        # Triage flag for severe clusters with enough volume to warrant a human.
        if band in ("CRITICAL", "HIGH") and c["cases"] >= MIN_ALERT_CASES:
            alerts.append(_alert(ts, band, "TRIAGE FLAG",
                                 f"TRIAGE FLAG: {c['cases']} cases routed to human "
                                 f"review — {c['name']}", c["id"]))

    # Newest first.
    alerts.sort(key=lambda a: a["timestamp"], reverse=True)
    return alerts[:30]


def _alert(ts, severity, kind, message, cluster_id):
    return {
        "timestamp": ts,
        "time": ts[11:16] if len(ts) >= 16 else ts,  # HH:MM
        "severity": severity,
        "type": kind,
        "message": message,
        "cluster_id": cluster_id,
    }


# ---------------------------------------------------------------------------
# Alert-volume trend (stacked-by-severity time series)
# ---------------------------------------------------------------------------

def build_trend(clusters: List[Dict], window: int = 90) -> List[Dict]:
    """
    Build a per-day stacked time series of case volume split by the severity
    band of the originating cluster, over the trailing `window` days. Drives the
    'Alert Volume Trend' area chart.
    """
    # Establish the window end from the latest activity.
    as_of_candidates = [datetime.fromisoformat(c["last_activity"])
                        for c in clusters if c.get("last_activity")]
    if not as_of_candidates:
        return []
    as_of = max(as_of_candidates)

    # day index (0 = oldest) → {critical, high, medium, low}
    series = [{"critical": 0, "high": 0, "medium": 0, "low": 0} for _ in range(window)]
    for c in clusters:
        band = c.get("severity_band", "MEDIUM").lower()
        for day_idx, count in enumerate(c.get("daily_counts", [])):
            if 0 <= day_idx < window and count:
                series[day_idx][band] = series[day_idx].get(band, 0) + count

    out = []
    for i, day in enumerate(series):
        d = as_of.date().fromordinal(as_of.date().toordinal() - (window - 1 - i))
        out.append({"date": d.isoformat(),
                    "label": d.strftime("%b %d"),
                    **day})
    return out


def build_trend_from_records(clusters: List[Dict], window: int = 185) -> List[Dict]:
    """Per-day case volume (stacked by the owning cluster's severity band) built
    from the REAL per-complaint `case_records` dates — not the synthetic
    `daily_counts`. This keeps the trend chart consistent with the drill-down,
    which also counts case_records by date, so a visible peak maps to the actual
    cases behind it.

    Falls back to build_trend() if clusters carry no case_records.
    """
    def _day(rec):
        v = rec.get("date_received")
        return (str(v)[:10]) if v else None

    days = [d for c in clusters for rec in c.get("case_records", [])
            if (d := _day(rec))]
    if not days:
        return build_trend(clusters, window)

    as_of = datetime.fromisoformat(max(days))
    series = {}  # iso date -> {critical,high,medium,low}
    seen = set()
    for c in clusters:
        band = c.get("severity_band", "MEDIUM").lower()
        for rec in c.get("case_records", []):
            cid = rec.get("complaint_id")
            if cid and cid in seen:
                continue
            if cid:
                seen.add(cid)
            d = _day(rec)
            if not d:
                continue
            delta = (as_of.date() - datetime.fromisoformat(d).date()).days
            if 0 <= delta < window:
                bucket = series.setdefault(d, {"critical": 0, "high": 0, "medium": 0, "low": 0})
                bucket[band] = bucket.get(band, 0) + 1

    out = []
    for i in range(window):
        day = as_of.date().fromordinal(as_of.date().toordinal() - (window - 1 - i))
        iso = day.isoformat()
        counts = series.get(iso, {"critical": 0, "high": 0, "medium": 0, "low": 0})
        out.append({"date": iso, "label": day.strftime("%b %d"), **counts})
    return out


def build_kpis(clusters: List[Dict], total_fetched: int, total_ai: int) -> Dict:
    """Top-line numbers for the dashboard header strip."""
    crit = sum(1 for c in clusters if c.get("severity_band") == "CRITICAL")
    esc = sum(1 for c in clusters if c.get("status") == "ESCALATING")
    total_cases = sum(c["cases"] for c in clusters)
    return {
        "active_clusters": len(clusters),
        "critical_clusters": crit,
        "escalating_clusters": esc,
        "ai_cases": total_ai,
        "total_cases_in_clusters": total_cases,
        "total_fetched": total_fetched,
        "match_rate": round(total_ai / total_fetched * 100, 2) if total_fetched else 0,
    }
