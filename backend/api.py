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

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import scoring

HERE = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_PATH = os.path.join(HERE, "output", "dashboard.json")
NOT_BUILT_MSG = "Dashboard not built yet — run: python build_dashboard.py"

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
    """Full dashboard payload: kpis, clusters (ranked, slim), alerts, trend."""
    data = _load()
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
    data = _load()
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
