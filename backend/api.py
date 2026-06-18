"""
api.py — ReguLens FastAPI server. Serves the prebuilt dashboard.json plus
filtered drill-down endpoints for the React frontend:

  GET  /api/dashboard           full payload (kpis, clusters, alerts, trend) — slim
  GET  /api/clusters            ranked clusters with optional filtering
  GET  /api/clusters/{id}       one cluster's full record (incl. case_records)
  GET  /api/cases               flattened per-complaint records, search + filter
  POST /api/rescore             re-rank clusters under regulator-tuned weights

Run:
    uvicorn api:app --reload --port 8050
"""

import json
import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()  # read backend/.env (keys, GEMINI_MODEL) before importing providers

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import live_features
import llm_providers
import scoring

HERE = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_PATH = os.path.join(HERE, "output", "dashboard.json")
WEIGHTS_PATH = os.path.join(HERE, "output", "weights_config.json")
CONFIG_PATH = os.path.join(HERE, "output", "config.json")
NOT_BUILT_MSG = "Dashboard not built yet — run: python build_dashboard.py"


def _saved_config() -> dict:
    """Customer overrides (currently: per-category regulatory-relevance priors)."""
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh) or {}
    except (OSError, json.JSONDecodeError):
        return {}


def _saved_weights() -> Optional[dict]:
    """Customer-tuned priority weights persisted via PUT /api/weights, if any."""
    try:
        with open(WEIGHTS_PATH, "r", encoding="utf-8") as fh:
            w = json.load(fh)
        return w if isinstance(w, dict) and w else None
    except (OSError, json.JSONDecodeError):
        return None


def _apply_saved_weights(data: dict) -> dict:
    """Re-rank the dashboard's clusters under any saved weights / relevance
    overrides, so a customer's tuned priorities take effect everywhere the
    clusters are served."""
    w = _saved_weights()
    reg = _saved_config().get("reg_relevance") or None
    if not w and not reg:
        return data
    if w:
        total = sum(w.values()) or 1.0
        w = {k: v / total for k, v in w.items()}
        data["weights"] = w
    data["clusters"] = scoring.score_clusters(data.get("clusters", []),
                                              weights=w or None, reg_relevance=reg)
    return data

app = FastAPI(title="ReguLens — Supervision Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load() -> dict:
    if not os.path.exists(DASHBOARD_PATH):
        raise HTTPException(status_code=503, detail=NOT_BUILT_MSG)
    try:
        with open(DASHBOARD_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        raise HTTPException(status_code=500, detail=f"Could not read dashboard: {exc}")


def _slim_cluster(c: dict) -> dict:
    """A cluster without the heavy per-case payload (for list/overview views)."""
    return {k: v for k, v in c.items() if k != "case_records"}


@app.get("/health")
def health():
    return {"status": "ok", "dashboard_built": os.path.exists(DASHBOARD_PATH)}


@app.get("/api/dashboard")
def dashboard():
    """Full dashboard payload: kpis, clusters (ranked, slim), alerts, trend.

    If a customer has saved tuned priority weights (PUT /api/weights), the
    clusters are re-ranked under them before being served.
    """
    data = _apply_saved_weights(_load())
    data["clusters"] = [_slim_cluster(c) for c in data.get("clusters", [])]
    return data


@app.get("/api/clusters")
def clusters(
    severity: Optional[str] = Query(None, description="Filter by severity_band"),
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=200),
):
    """Ranked clusters with optional filtering — backs the rankings + table."""
    data = _apply_saved_weights(_load())
    items = [_slim_cluster(c) for c in data.get("clusters", [])]
    if severity:
        items = [c for c in items if c.get("severity_band", "").lower() == severity.lower()]
    if status:
        items = [c for c in items if c.get("status", "").lower() == status.lower()]
    if category:
        items = [c for c in items if c.get("category", "").lower() == category.lower()]
    return {"total": len(items), "clusters": items[:limit]}


@app.get("/api/clusters/{cluster_id}")
def cluster_detail(cluster_id: str):
    """One cluster's full record, including sample narratives + case records."""
    for c in _load().get("clusters", []):
        if c.get("id") == cluster_id:
            return c
    raise HTTPException(status_code=404, detail=f"Cluster {cluster_id} not found")


@app.get("/api/cases")
def cases(
    q: Optional[str] = Query(None, description="Search narrative / company / issue / id"),
    cluster_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=2000),
    offset: int = Query(0, ge=0),
):
    """Flattened per-complaint records across all clusters, with search/filter.

    Each record carries its owning cluster's id, name, category and severity so
    the case view can show context without a second lookup.
    """
    data = _load()
    rows = []
    seen = set()
    for c in data.get("clusters", []):
        for rec in c.get("case_records", []):
            cid = rec.get("complaint_id")
            # The month-chunked crawl can fetch a complaint twice at month
            # boundaries — dedupe by complaint id so counts and keys are clean.
            if cid and cid in seen:
                continue
            if cid:
                seen.add(cid)
            rows.append({
                **rec,
                "cluster_name": c.get("name"),
                "category": c.get("category"),
                "severity_band": c.get("severity_band"),
            })

    if cluster_id:
        rows = [r for r in rows if r.get("cluster_id") == cluster_id]
    if category:
        rows = [r for r in rows if (r.get("category") or "").lower() == category.lower()]
    if company:
        rows = [r for r in rows if company.lower() in (r.get("company") or "").lower()]
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in " ".join(str(r.get(k, "")) for k in
                ("narrative", "company", "issue", "complaint_id", "cluster_name")).lower()]

    total = len(rows)
    return {"total": total, "offset": offset, "limit": limit,
            "cases": rows[offset:offset + limit]}


class Weights(BaseModel):
    frequency: float = Field(ge=0)
    severity: float = Field(ge=0)
    growth: float = Field(ge=0)
    regulatory_relevance: float = Field(ge=0)


@app.post("/api/rescore")
def rescore(weights: Weights):
    """Re-rank the existing clusters under regulator-tuned priority weights.

    Reuses the real scoring engine (scoring.score_clusters) so the on-screen
    weight sliders drive the exact same maths the offline pipeline uses. Returns
    a slim, re-ranked list (no heavy per-case payload).
    """
    data = _load()
    clusters_in = [_slim_cluster(c) for c in data.get("clusters", [])]
    w = weights.model_dump()
    total = sum(w.values()) or 1.0
    w = {k: v / total for k, v in w.items()}  # normalise so weights sum to 1
    ranked = scoring.score_clusters(clusters_in, weights=w)
    slim = [{"id": c["id"], "name": c["name"], "category": c["category"],
             "cases": c["cases"], "growth_7d": c["growth_7d"],
             "severity_band": c["severity_band"], "status": c["status"],
             "priority": c["priority"], "priority_pct": c["priority_pct"],
             "rank": c["rank"]} for c in ranked]
    return {"weights": w, "clusters": slim}


@app.get("/api/weights")
def get_weights():
    """The active priority weights: customer-saved if present, else the build
    defaults. Backs the Scoring page's persisted-weights CRUD."""
    saved = _saved_weights()
    return {"weights": saved or _load().get("weights", scoring.DEFAULT_WEIGHTS),
            "is_custom": saved is not None,
            "defaults": scoring.DEFAULT_WEIGHTS}


@app.put("/api/weights")
def put_weights(weights: Weights):
    """Persist customer-tuned priority weights so they take effect across the
    dashboard. Sending all-zero / the defaults clears the override."""
    w = weights.model_dump()
    if sum(w.values()) <= 0 or w == scoring.DEFAULT_WEIGHTS:
        try:
            os.remove(WEIGHTS_PATH)
        except OSError:
            pass
        return {"weights": scoring.DEFAULT_WEIGHTS, "is_custom": False,
                "defaults": scoring.DEFAULT_WEIGHTS}
    os.makedirs(os.path.dirname(WEIGHTS_PATH), exist_ok=True)
    with open(WEIGHTS_PATH, "w", encoding="utf-8") as fh:
        json.dump(w, fh)
    return {"weights": w, "is_custom": True, "defaults": scoring.DEFAULT_WEIGHTS}


@app.delete("/api/weights")
def delete_weights():
    """Reset to the default priority weights."""
    try:
        os.remove(WEIGHTS_PATH)
    except OSError:
        pass
    return {"weights": scoring.DEFAULT_WEIGHTS, "is_custom": False,
            "defaults": scoring.DEFAULT_WEIGHTS}


@app.get("/api/config")
def get_config():
    """Editable engine config: per-category regulatory-relevance priors.
    Returns the active (saved-or-default) map plus the built-in defaults."""
    saved = _saved_config().get("reg_relevance") or {}
    return {"reg_relevance": {**scoring.REG_RELEVANCE, **saved},
            "defaults": scoring.REG_RELEVANCE,
            "is_custom": bool(saved)}


class RegRelevanceConfig(BaseModel):
    reg_relevance: dict


@app.put("/api/config")
def put_config(cfg: RegRelevanceConfig):
    """Persist per-category regulatory-relevance overrides (0..1), applied live
    across the dashboard. Only known categories with values in [0,1] are kept."""
    clean = {}
    for k, v in (cfg.reg_relevance or {}).items():
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        if k in scoring.REG_RELEVANCE and 0.0 <= fv <= 1.0:
            clean[k] = round(fv, 2)
    # Drop entries equal to the default so we only store true overrides.
    overrides = {k: v for k, v in clean.items() if v != scoring.REG_RELEVANCE.get(k)}
    existing = _saved_config()
    if overrides:
        existing["reg_relevance"] = overrides
    else:
        existing.pop("reg_relevance", None)
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as fh:
        json.dump(existing, fh)
    return {"reg_relevance": {**scoring.REG_RELEVANCE, **overrides},
            "defaults": scoring.REG_RELEVANCE, "is_custom": bool(overrides)}


@app.delete("/api/config")
def delete_config():
    """Reset regulatory-relevance priors to defaults."""
    existing = _saved_config()
    existing.pop("reg_relevance", None)
    try:
        if existing:
            with open(CONFIG_PATH, "w", encoding="utf-8") as fh:
                json.dump(existing, fh)
        else:
            os.remove(CONFIG_PATH)
    except OSError:
        pass
    return {"reg_relevance": scoring.REG_RELEVANCE, "defaults": scoring.REG_RELEVANCE,
            "is_custom": False}


@app.get("/api/alerts")
def alerts(severity: Optional[str] = Query(None), limit: int = Query(30, ge=1, le=100)):
    """Live alert feed, optionally filtered by severity."""
    items = _load().get("alerts", [])
    if severity and severity.upper() != "ALL":
        items = [a for a in items if a.get("severity", "").upper() == severity.upper()]
    return {"total": len(items), "alerts": items[:limit]}


@app.get("/api/trend")
def trend():
    """Alert-volume trend (stacked by severity)."""
    return {"trend": _load().get("trend", [])}


# ---------------------------------------------------------------------------
# Alert methodology (item 4) — single source of truth = scoring constants
# ---------------------------------------------------------------------------

@app.get("/api/methodology")
def methodology():
    """Document how alerts, severity and priority are computed, derived from the
    scoring module's constants so the UI and the engine never drift apart."""
    m = scoring.MIN_ALERT_CASES
    bands = [{"min_score": t, "band": b} for t, b in scoring.SEVERITY_BANDS]
    return {
        "alert_types": [
            {"type": "SPIKE", "severity": "CRITICAL",
             "trigger": f"7-day growth ≥ +100% AND cases ≥ {m}",
             "meaning": "Sudden surge in case volume for a harm pattern."},
            {"type": "ESCALATING", "severity": "cluster band",
             "trigger": f"status = ESCALATING (growth ≥ +40%) AND cases ≥ {m}",
             "meaning": "Pattern accelerating fast — catch it early."},
            {"type": "PERSISTENT/SIMMERING", "severity": "cluster band",
             "trigger": "status = PERSISTENT (≥30 days old, active in last 14 days)",
             "meaning": "Entrenched, long-lived harm that isn't resolving."},
            {"type": "NEW CLUSTER", "severity": "cluster band",
             "trigger": "first activity within trailing 7 days AND cases ≥ 3",
             "meaning": "A newly emerging harm pattern."},
            {"type": "TRIAGE FLAG", "severity": "CRITICAL/HIGH",
             "trigger": f"severity band CRITICAL or HIGH AND cases ≥ {m}",
             "meaning": "Severe and large enough to route to a human reviewer."},
        ],
        "min_alert_cases": m,
        "severity": {
            "formula": "severity = 0.44·cases_norm + 0.31·growth_norm + 0.25·signal_norm",
            "detail": {
                "cases_norm": "cluster cases ÷ largest cluster's cases",
                "growth_norm": "min(max(growth_7d,0) / 200, 1) — +200% ⇒ 1.0",
                "signal_norm": "count of severe implied signals "
                               "(no_human, no_explanation, action_without_notice) ÷ 3",
            },
            "bands": bands,
        },
        "priority": {
            "formula": "priority = w_freq·frequency + w_sev·severity "
                       "+ w_grow·growth + w_reg·regulatory_relevance",
            "note": "All dimensions normalised to [0,1]; weights normalised to sum 1.",
            "default_weights": scoring.DEFAULT_WEIGHTS,
            "regulatory_relevance_priors": scoring.REG_RELEVANCE,
        },
    }


# ---------------------------------------------------------------------------
# Live chart drill-down (item 5)
# ---------------------------------------------------------------------------

@app.get("/api/drilldown")
def drilldown(date: str = Query(..., description="YYYY-MM-DD")):
    """What actually spiked on `date`: real CFPB case aggregation + best-effort
    grounded web-news synthesis via the selected analysis engine."""
    return live_features.drilldown(_load(), date)


# ---------------------------------------------------------------------------
# Analysis engine selection (item 7)
# ---------------------------------------------------------------------------

@app.get("/api/providers")
def providers():
    """Which LLM providers are configured + the currently selected engine."""
    return llm_providers.providers_status()


class EngineChoice(BaseModel):
    engine: str = Field(description="auto | score | claude | gemini")


@app.post("/api/analysis-config")
def set_analysis_config(choice: EngineChoice):
    """Set the live analysis engine used by drill-down + action drafting."""
    try:
        llm_providers.set_engine(choice.engine)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return llm_providers.providers_status()


@app.get("/api/analysis-config")
def get_analysis_config():
    return llm_providers.providers_status()


# ---------------------------------------------------------------------------
# Semi-automated supervisory actions (item 6) — draft + simulated send
# ---------------------------------------------------------------------------

class DraftRequest(BaseModel):
    cluster_id: str
    action: str


@app.post("/api/draft-action")
def draft_action(req: DraftRequest):
    """Draft a regulation-anchored information request for a recommended action,
    auto-matched to the firm, via the selected engine (or a template fallback)."""
    try:
        return live_features.draft_action(_load(), req.cluster_id, req.action)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


class SendRequest(BaseModel):
    cluster_id: Optional[str] = None
    subject: str
    body: str
    recipient: dict
    legal_basis: Optional[str] = None


@app.post("/api/send-action")
def send_action(req: SendRequest):
    """Record an action to the file-based outbox. NB: sending is SIMULATED — no
    real email is dispatched."""
    return live_features.append_outbox(req.model_dump())


@app.get("/api/outbox")
def outbox():
    """List items recorded to the (simulated) outbox."""
    items = live_features.read_outbox()
    return {"total": len(items), "items": items}
