"""
build_dashboard.py — ReguLens end-to-end pipeline.

  CFPB complaints
      → Stage 1  ai_filter.generate_candidates   (high-recall two-signal filter)
      → Stage 2  llm_adjudicator.adjudicate       (precision: LLM or score)
      → Stage 3  cluster.build_clusters           (unsupervised harm-pattern discovery)
      → Stage 4  scoring.{score_clusters,alerts,trend,kpis}  (prioritise + alert)
      → output/dashboard.json                      (served by api.py)

Run:
    # 1. pip install -r requirements.txt
    # 2. python build_dashboard.py        ← builds output/dashboard.json
    # 3. uvicorn api:app --reload         ← serves it at http://localhost:8000
    # 4. start the frontend (see ../frontend)

Env:
    REFRESH=1            force a fresh CFPB crawl instead of using output/raw_cache.json
    MONTHS_BACK=6        crawl depth in months (default 6)
    ADJUDICATE_BACKEND   auto|llm|score (default auto → llm if ANTHROPIC_API_KEY else score)
    ADJUDICATE_MAX       cap LLM calls (0 = no cap)
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone

import ai_filter
import assessment
import cfpb_client
import cluster
import llm_adjudicator
import scoring

HERE = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(HERE, "output")
RAW_CACHE = os.path.join(OUTPUT_DIR, "raw_cache.json")
DASHBOARD_PATH = os.path.join(OUTPUT_DIR, "dashboard.json")

USE_CACHE = os.environ.get("REFRESH", "0") != "1"
MONTHS_BACK = int(os.environ.get("MONTHS_BACK", "6"))
ADJUDICATE_BACKEND = os.environ.get("ADJUDICATE_BACKEND", "auto")
ADJUDICATE_MAX = int(os.environ.get("ADJUDICATE_MAX", "0"))
# Stage 5 supervisory assessment backend + cap (LLM is per-cluster).
ASSESS_BACKEND = os.environ.get("ASSESS_BACKEND", "auto")
ASSESS_MAX = int(os.environ.get("ASSESS_MAX", "0"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s",
                    datefmt="%H:%M:%S")
logger = logging.getLogger("build_dashboard")


def _load_or_fetch():
    if USE_CACHE and os.path.exists(RAW_CACHE):
        cached = cfpb_client.load_raw_cache(RAW_CACHE)
        if cached:
            print(f"♻️  Loaded {len(cached):,} records from cache")
            return cached
    data = cfpb_client.fetch_complaints(months_back=MONTHS_BACK)
    cfpb_client.save_raw_cache(data, RAW_CACHE)
    return data


def run() -> int:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    try:
        raw = _load_or_fetch()
    except Exception as exc:  # noqa: BLE001
        print(f"❌ CFPB fetch failed: {exc}")
        return 1

    total_fetched = len(raw)
    print(f"✅ Fetched {total_fetched:,} complaints from CFPB")
    if not total_fetched:
        return 1

    # Stage 1 + 2
    print("🔍 Stage 1: candidate generation (likelihood × narrative signal)...")
    candidates = ai_filter.generate_candidates(raw)
    print(f"   {len(candidates):,} candidates")
    print(f"⚖️  Stage 2: adjudication (backend={ADJUDICATE_BACKEND})...")
    adjudicated = llm_adjudicator.adjudicate(candidates, backend=ADJUDICATE_BACKEND,
                                             max_candidates=ADJUDICATE_MAX)
    ai_df = adjudicated[adjudicated["ai_related"]].copy() if len(adjudicated) else adjudicated
    total_ai = len(ai_df)
    backend_used = adjudicated["adjudicator"].iloc[0] if len(adjudicated) else ADJUDICATE_BACKEND
    print(f"✅ {total_ai:,} confirmed AI-related complaints (via {backend_used})")

    # Stage 3: cluster
    print("🧩 Stage 3: clustering harm patterns (TF-IDF + KMeans, unsupervised)...")
    clusters = cluster.build_clusters(ai_df)
    print(f"   {len(clusters)} clusters")

    # Stage 4: score, rank, alert, trend
    print("📊 Stage 4: scoring, ranking, alerts, trend...")
    clusters = scoring.score_clusters(clusters)
    alerts = scoring.build_alerts(clusters)
    trend = scoring.build_trend(clusters)
    kpis = scoring.build_kpis(clusters, total_fetched, total_ai)

    # Stage 5: per-cluster supervisory assessment (why concerning / why AI /
    # Consumer Duty breach / mechanism hypotheses / regulator actions).
    print(f"🧑‍⚖️  Stage 5: supervisory assessments (backend={ASSESS_BACKEND})...")
    clusters = assessment.assess_clusters(clusters, backend=ASSESS_BACKEND,
                                          max_clusters=ASSESS_MAX)
    assess_backend = clusters[0]["assessment"]["generated_by"] if clusters else ASSESS_BACKEND

    dashboard = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_source": "CFPB Consumer Complaint Database",
        "adjudicator": backend_used,
        "assessment_backend": assess_backend,
        "weights": scoring.DEFAULT_WEIGHTS,
        "kpis": kpis,
        "clusters": clusters,
        "alerts": alerts,
        "trend": trend,
    }
    try:
        with open(DASHBOARD_PATH, "w", encoding="utf-8") as fh:
            json.dump(dashboard, fh, ensure_ascii=False, indent=2, default=str)
    except Exception as exc:  # noqa: BLE001
        print(f"❌ Could not write dashboard.json: {exc}")
        return 1

    top = clusters[0] if clusters else None
    if top:
        print(f"🏆 Top priority: {top['name']} "
              f"({top['cases']} cases, {top['severity_band']}, "
              f"+{top['growth_7d']:.0f}%/7d, priority {top['priority_pct']}%)")
    print(f"💾 Saved {os.path.relpath(DASHBOARD_PATH)} "
          f"({len(clusters)} clusters, {len(alerts)} alerts, {len(trend)}-day trend)")
    return 0


if __name__ == "__main__":
    sys.exit(run())
