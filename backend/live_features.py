"""
live_features.py — runtime (request-time) intelligence for ReguLens.

Unlike the offline pipeline (build_dashboard.py → dashboard.json), these
features run live when a supervisor interacts with the dashboard:

  • drilldown(date)       — what actually spiked on a given day. Aggregates the
                            REAL CFPB case records from dashboard.json for that
                            date, then (best-effort) runs a grounded web search
                            via the selected LLM provider to surface real news
                            and a "what likely happened + how to act" synthesis.
                            Degrades to a data-only summary when no LLM key.

  • draft_action(...)     — turn a recommended supervisory action into a
                            regulation-anchored draft letter (e.g. an FSMA s.165
                            information request), auto-matched to the firm. Uses
                            the selected LLM provider, or a deterministic
                            template when no key is configured.

  • outbox                — append/read a file-based outbox. Sending is SIMULATED
                            (no real email is dispatched) — the outbox records
                            what *would* be sent so a human stays in the loop.

The selected provider comes from llm_providers (the live engine selector on the
Scoring page). Everything is defensive: any LLM failure falls back to
deterministic output so the app works with zero keys.
"""

import json
import logging
import os
from collections import Counter
from datetime import datetime, timezone
from typing import Dict, List, Optional

import llm_providers

logger = logging.getLogger("live_features")

_HERE = os.path.dirname(os.path.abspath(__file__))
OUTBOX_PATH = os.path.join(_HERE, "output", "outbox.json")
DRILLDOWN_CACHE_PATH = os.path.join(_HERE, "output", "drilldown_cache.json")


def _load_cache() -> Dict:
    try:
        with open(DRILLDOWN_CACHE_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return {}


def _save_cache(cache: Dict) -> None:
    os.makedirs(os.path.dirname(DRILLDOWN_CACHE_PATH), exist_ok=True)
    with open(DRILLDOWN_CACHE_PATH, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Drill-down
# ---------------------------------------------------------------------------

def _day(s: Optional[str]) -> str:
    return (s or "")[:10]


def drilldown(dashboard: Dict, date: str, engine: Optional[str] = None) -> Dict:
    """Aggregate real case records for `date` (YYYY-MM-DD) + best-effort news.

    Successful LLM results are cached per (date, engine) so repeat clicks are
    instant and survive provider rate limits. Data-only fallbacks (e.g. a failed
    LLM call) are NOT cached, so they retry once the quota recovers.
    """
    resolved = llm_providers.resolve_engine(engine)
    cache_key = f"{date}|{resolved}"
    cache = _load_cache()
    if cache_key in cache:
        return {**cache[cache_key], "cached": True}

    rows: List[Dict] = []
    seen = set()
    for c in dashboard.get("clusters", []):
        for rec in c.get("case_records", []):
            if _day(rec.get("date_received")) != date:
                continue
            cid = rec.get("complaint_id")
            if cid and cid in seen:
                continue
            if cid:
                seen.add(cid)
            rows.append({**rec, "cluster_name": c.get("name"),
                         "category": c.get("category")})

    companies = Counter(r["company"] for r in rows if r.get("company"))
    issues = Counter(r["issue"] for r in rows if r.get("issue"))
    clusters = Counter(r["cluster_name"] for r in rows if r.get("cluster_name"))

    top_companies = [{"name": k, "count": v} for k, v in companies.most_common(5)]
    top_issues = [{"name": k, "count": v} for k, v in issues.most_common(5)]
    top_clusters = [{"name": k, "count": v} for k, v in clusters.most_common(5)]

    # Suggested actions: reuse the matched clusters' existing assessment actions.
    suggested: List[str] = []
    for cl_name, _ in clusters.most_common(2):
        for c in dashboard.get("clusters", []):
            if c.get("name") == cl_name:
                for a in (c.get("assessment", {}) or {}).get("actions", [])[:2]:
                    if a.get("action") and a["action"] not in suggested:
                        suggested.append(a["action"])
    suggested = suggested[:4]

    result = {
        "date": date,
        "total": len(rows),
        "top_companies": top_companies,
        "top_issues": top_issues,
        "top_clusters": top_clusters,
        "suggested_actions": suggested,
        "narrative": None,
        "news": [],
        "provider": "data-only",
    }

    if not rows:
        result["narrative"] = (f"No AI/automation-flagged complaints were recorded "
                               f"on {date} in the current dataset.")
        return result

    # Best-effort grounded web research for the day's drivers.
    firm_str = ", ".join(c["name"] for c in top_companies[:3]) or "consumer-finance firms"
    issue_str = ", ".join(i["name"] for i in top_issues[:3]) or "automated decisions"
    query = (
        f"Search the web for news on or around {date} about {firm_str} relating "
        f"to {issue_str}, automated/algorithmic decision-making, account closures, "
        f"debanking, or AI in consumer finance. Then, in 4-6 complete sentences "
        f"(finish every sentence), summarise what may have driven a rise in "
        f"consumer complaints around that date and how a UK financial regulator "
        f"(FCA) should respond. Base it on real, recent sources and cite them — "
        f"always perform a web search even if you think you know the answer."
    )
    research = llm_providers.web_research(query, engine=engine)
    if research:
        result["narrative"] = research.get("narrative") or None
        result["news"] = research.get("news") or []
        result["provider"] = research.get("provider", "llm")

    if not result["narrative"]:
        result["narrative"] = (
            f"{len(rows)} AI/automation-flagged complaint(s) on {date}, "
            f"concentrated at {firm_str} around {issue_str}. "
            f"(No LLM provider configured — showing data-only analysis. Set an "
            f"analysis engine with a key to enable live news correlation.)")

    # Cache only real LLM syntheses so a transient rate-limit/failure isn't
    # frozen in as a data-only result.
    if result["provider"] not in ("data-only",):
        cache = _load_cache()
        cache[cache_key] = result
        _save_cache(cache)
    return result


# ---------------------------------------------------------------------------
# Action drafting
# ---------------------------------------------------------------------------

def _find_cluster(dashboard: Dict, cluster_id: str) -> Optional[Dict]:
    for c in dashboard.get("clusters", []):
        if c.get("id") == cluster_id:
            return c
    return None


def _recipient_for(firm: str) -> Dict:
    """Best-effort recipient match. The contact details are a clearly-labelled
    stub for the demo — a real deployment would resolve these from the FCA
    Financial Services Register."""
    slug = "".join(ch.lower() for ch in firm if ch.isalnum()) or "firm"
    return {
        "firm": firm,
        "email": f"compliance@{slug}.example",
        "address": f"The Compliance Officer, {firm}, United Kingdom",
        "note": "Auto-matched stub — verify against the FCA Register before sending.",
    }


def draft_action(dashboard: Dict, cluster_id: str, action: str,
                 engine: Optional[str] = None) -> Dict:
    cluster = _find_cluster(dashboard, cluster_id)
    if cluster is None:
        raise KeyError(f"Cluster {cluster_id} not found")

    firm = (cluster.get("companies") or ["the firm"])[0]
    recipient = _recipient_for(firm)
    legal_basis = "FSMA 2000 s.165 (power to require information)"

    resolved = llm_providers.resolve_engine(engine)
    drafted = None
    if resolved in ("claude", "gemini"):
        drafted = _draft_llm(cluster, action, firm, resolved)

    if not drafted:
        drafted = _draft_template(cluster, action, firm)

    return {
        "cluster_id": cluster_id,
        "cluster_name": cluster.get("name"),
        "recipient": recipient,
        "legal_basis": legal_basis,
        "subject": drafted["subject"],
        "body": drafted["body"],
        "provider": drafted.get("provider", "template"),
    }


def _draft_llm(cluster: Dict, action: str, firm: str, engine: str) -> Optional[Dict]:
    system = (
        "You are an FCA supervision officer drafting a formal, professional "
        "information request to a regulated firm. The letter must be precise, "
        "proportionate and grounded in the supervisory concern. Cite the legal "
        "basis (FSMA 2000 s.165) and set a reasonable response deadline. Keep it "
        "to a tight business letter — no placeholders beyond the firm name."
    )
    user = (
        f"Firm: {firm}\n"
        f"Harm cluster: {cluster.get('name')} ({cluster.get('category')})\n"
        f"Cases: {cluster.get('cases')} | Severity: {cluster.get('severity_band')}\n"
        f"Detection signals: {', '.join(cluster.get('matched_signals') or []) or '(none)'}\n"
        f"Supervisory action to action: {action}\n\n"
        "Return ONLY JSON: {\"subject\": string, \"body\": string}. The body is "
        "the full letter text (greeting, paragraphs, sign-off as 'FCA "
        "Supervision Team')."
    )
    if engine == "gemini":
        d = llm_providers.gemini_json(system, user, max_tokens=1200)
        if d and d.get("body"):
            return {"subject": d.get("subject", "Information request"),
                    "body": d["body"], "provider": "gemini"}
        return None
    # claude
    try:
        import anthropic
        from pydantic import BaseModel
        class Letter(BaseModel):
            subject: str
            body: str
        client = anthropic.Anthropic()
        resp = client.messages.parse(
            model=llm_providers.ANTHROPIC_MODEL, max_tokens=1200,
            system=system, messages=[{"role": "user", "content": user}],
            output_format=Letter)
        out = resp.parsed_output
        if out:
            return {"subject": out.subject, "body": out.body, "provider": "claude"}
    except Exception as exc:  # noqa: BLE001
        logger.warning("_draft_llm (claude) failed: %s", exc)
    return None


def _draft_template(cluster: Dict, action: str, firm: str) -> Dict:
    today = datetime.now(timezone.utc).strftime("%d %B %Y")
    name = cluster.get("name", "the identified harm pattern")
    cases = cluster.get("cases", "a number of")
    subject = f"Information request under FSMA 2000 s.165 — {name}"
    body = (
        f"{today}\n\n"
        f"Dear Compliance Officer,\n\n"
        f"Re: Request for information under section 165 of the Financial Services "
        f"and Markets Act 2000\n\n"
        f"The Financial Conduct Authority has identified a pattern of consumer "
        f"detriment associated with {firm} in relation to \"{name}\". Our "
        f"supervisory analysis of {cases} consumer complaints indicates potential "
        f"harm arising from automated or algorithmic decision-making.\n\n"
        f"In order to assess this concern, and pursuant to our powers under s.165 "
        f"FSMA 2000, we require the following:\n\n"
        f"  {action}\n\n"
        f"Please also provide the model purpose, version and change log over the "
        f"affected period, validation reports, and relevant decline / "
        f"false-positive / exit-rate metrics.\n\n"
        f"We request your response within 28 days of the date of this letter. If "
        f"you have any questions regarding the scope of this request, please "
        f"contact the supervision team.\n\n"
        f"Yours faithfully,\n\n"
        f"FCA Supervision Team"
    )
    return {"subject": subject, "body": body, "provider": "template"}


# ---------------------------------------------------------------------------
# Outbox (simulated send)
# ---------------------------------------------------------------------------

def read_outbox() -> List[Dict]:
    try:
        with open(OUTBOX_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return []


def append_outbox(item: Dict) -> Dict:
    items = read_outbox()
    entry = {
        "id": f"OUT-{len(items) + 1:04d}",
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "simulated": True,
        **item,
    }
    items.append(entry)
    os.makedirs(os.path.dirname(OUTBOX_PATH), exist_ok=True)
    with open(OUTBOX_PATH, "w", encoding="utf-8") as fh:
        json.dump(items, fh, ensure_ascii=False, indent=2)
    logger.info("Outbox append (SIMULATED send): %s → %s",
                entry["id"], item.get("recipient", {}).get("email"))
    return entry
