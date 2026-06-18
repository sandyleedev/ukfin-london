# ReguLens — Supervision Intelligence

> A new lens to view financial regulation.

**🔗 Live demo → https://ukfin-london.vercel.app**
&nbsp;·&nbsp; [Roadmap & known limitations](docs/ROADMAP.md) &nbsp;·&nbsp; [Business / GTM](docs/BUSINESS.md)

ReguLens is an early-warning system that mines the **CFPB Consumer Complaint
Database** for **AI / automation-driven consumer harm**, clusters it into
recurring patterns, and ranks those patterns so a regulator can see *what to act
on first* — balancing consumer protection with financial innovation.

The dashboard is a four-area workflow for a supervision team:

| Page | What it answers |
|---|---|
| **Overview** | What needs attention *right now* — KPIs, the priority-ranked harm clusters, the live alert feed, and the alert-volume trend. |
| **Clusters** | The full, sortable/filterable table of every identified harm pattern; drill into any cluster's detail and supervisory assessment. |
| **Cases** | Every individual CFPB complaint behind the clusters — search, filter, read the narrative, and **close cases** as they're actioned. |
| **Scoring** | The transparent priority formula. Authorised supervisors unlock the weight sliders and watch the queue **re-rank live**. |

## What's new (Phase 2)

- **Mobile-responsive** layout across every page (stacking panels, scrollable
  tables, responsive drawers/modals).
- **First-run guided tour** — a skippable, desktop walkthrough of the dashboard;
  replay any time from the header `?` button.
- **Real chart drill-down** — click any point on the trend chart to analyse that
  day: the actual CFPB cases that drove it, plus a best-effort grounded web-news
  correlation via the selected LLM.
- **Semi-automated actions** — turn a recommended supervisory action into a
  regulation-anchored draft letter (auto-matched recipient), edit it, and record
  it to a **simulated** outbox (no real email is sent).
- **Two LLM providers** — Anthropic Claude *and* Google Gemini, with a live
  engine selector on the Scoring page (plus the deterministic no-key fallback).
- **Alert methodology reference** — "Why these alerts?" opens the exact
  thresholds and severity/priority formulas, sourced from the scoring engine.

## The pipeline (workflow)

```
CFPB API  ─►  Stage 1: candidate filter   ─►  Stage 2: adjudication   ─►
              (likelihood × narrative          (LLM via Claude, or a
               signal — high recall)            deterministic score)

          ─►  Stage 3: clustering          ─►  Stage 4: scoring + alerts
              (TF-IDF + KMeans, unsupervised    (weighted priority, severity,
               harm-pattern discovery)           status, live alerts, trend)

          ─►  Stage 5: supervisory assessment ─► dashboard.json ─► FastAPI ─► React
```

**Why clustering, not random forest:** we have no labelled training data telling
us which harm pattern a complaint belongs to — the goal is to *discover* the
patterns. That is an unsupervised problem (TF-IDF + KMeans, k chosen by
silhouette). Random forest is supervised and would need labels we don't have.

**Priority score** (transparent, tunable weights — editable live on the Scoring page):
`0.28·frequency + 0.33·severity + 0.22·growth + 0.17·regulatory_relevance`.

## Layout

```
ReguLens/
├── backend/        Python pipeline + FastAPI
│   ├── cfpb_client.py        CFPB fetcher (month-chunked, retry/backoff, rate-limit delay)
│   ├── ai_filter.py          Stage 1: two-signal candidate filter
│   ├── llm_adjudicator.py    Stage 2: LLM (Claude) or deterministic score
│   ├── cluster.py            Stage 3: TF-IDF + KMeans clustering (+ per-case records)
│   ├── scoring.py            Stage 4: priority, severity, alerts, trend
│   ├── assessment.py         Stage 5: per-cluster supervisory assessment
│   ├── build_dashboard.py    orchestrator → output/dashboard.json
│   ├── api.py                FastAPI: dashboard / clusters / cases / rescore
│   └── output/dashboard.json prebuilt payload (committed; raw_cache.json is gitignored)
└── frontend/       Vite + React + Tailwind + recharts + react-router
    └── src/pages/  Overview · Clusters · Cases · Scoring
```

### API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/dashboard` | full payload (kpis, ranked clusters, alerts, trend) |
| GET | `/api/clusters` | ranked clusters, filterable |
| GET | `/api/clusters/{id}` | one cluster incl. case records |
| GET | `/api/cases` | flattened per-complaint records, search + filter |
| POST | `/api/rescore` | re-rank clusters under regulator-tuned weights |
| GET | `/api/methodology` | alert thresholds + severity/priority formulas (from the scoring constants) |
| GET | `/api/drilldown?date=` | real same-day case aggregation + best-effort grounded web-news synthesis |
| GET | `/api/providers` | which LLM providers are configured + selected live engine |
| GET·POST | `/api/analysis-config` | get / set the live analysis engine (`auto·score·claude·gemini`) |
| POST | `/api/draft-action` | draft a regulation-anchored information request for a recommended action |
| POST | `/api/send-action` | record an action to the file-based outbox (**simulated send — no real email**) |
| GET | `/api/outbox` | list items recorded to the simulated outbox |

## Run it locally

**Backend** (port 8050 — the frontend proxies `/api` here):
```bash
cd backend
pip install -r requirements.txt

# First run: crawl ~6 months of real CFPB data, then build the dashboard.
# (~2 min; uses a polite delay between month chunks to avoid the API's 429 limit)
REFRESH=1 python build_dashboard.py

# Subsequent runs use the local cache (fast, no network):
python build_dashboard.py

uvicorn api:app --reload --port 8050
```

> **Why is `raw_cache.json` missing?** The raw CFPB crawl cache is ~200 MB — over
> GitHub's 100 MB file limit — so it's gitignored. The *built* `dashboard.json`
> (which the app actually serves) **is** committed, so you can run the app without
> ever crawling. Run `REFRESH=1 python build_dashboard.py` only to refresh data.

**Frontend** (port 5173):
```bash
cd frontend
npm install
npm run dev          # open http://localhost:5173
```

## Deploy to the cloud (free)

Frontend → **Vercel**, backend → **Render**. Both have free tiers, and because
`dashboard.json` is committed, the backend needs no crawl at deploy time.

**1. Backend on Render**
1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New → Blueprint**, select the repo. It
   reads `render.yaml` and creates the `regulens-api` web service automatically.
3. After it deploys, copy the URL, e.g. `https://regulens-api.onrender.com`.

> Render's free web services spin down when idle, so the first request after a
> pause takes ~30–50 s to wake. Fine for a portfolio demo.

**2. Frontend on Vercel**
1. On [vercel.com](https://vercel.com): **Add New → Project**, import the repo.
2. Set **Root Directory** to `frontend` (framework auto-detects as Vite).
3. Add an environment variable:
   `VITE_API_BASE = https://regulens-api.onrender.com` (your Render URL).
4. Deploy. `frontend/vercel.json` rewrites client routes to `index.html` so
   `/overview`, `/cases`, etc. don't 404 on refresh.

That's it — share the Vercel URL.

### Future cloud (AWS / GCP)

Vercel + Render is the zero-cost demo footprint. For a production / scaled
deployment the intended path is:

- **API** → a container (the FastAPI app) on **AWS ECS/Fargate** or **GCP Cloud
  Run** — both autoscale to zero and remove Render's cold-start.
- **Artifacts** (`dashboard.json`, future model outputs) → **S3** / **GCS**,
  with the API reading the latest object instead of a committed file.
- **Scheduled crawl + rebuild** → **EventBridge + Fargate task** / **Cloud
  Scheduler + Cloud Run Job**, so data refreshes on a cadence.
- **Frontend** → CloudFront/S3 or Firebase Hosting (or keep Vercel).
- **Secrets** → AWS Secrets Manager / GCP Secret Manager (never in the repo).

See [docs/ROADMAP.md](docs/ROADMAP.md) for the fuller plan.

## Options

| Env var | Effect |
|---|---|
| `REFRESH=1` | force a fresh CFPB crawl instead of using `output/raw_cache.json` |
| `MONTHS_BACK=6` | crawl depth in months (default 6) |
| `CFPB_CHUNK_DELAY=6` | seconds to pause between month chunks (avoids HTTP 429) |
| `ADJUDICATE_BACKEND=llm\|gemini\|score\|auto` | Stage 2 backend (`auto` = Claude if `ANTHROPIC_API_KEY`, else Gemini if `GOOGLE_API_KEY`, else score) |
| `ASSESS_BACKEND=llm\|gemini\|rules\|auto` | Stage 5 supervisory-assessment backend (same `auto` precedence) |
| `ANTHROPIC_API_KEY=...` | enables the Claude adjudicator / assessments / live web-search drill-down |
| `GOOGLE_API_KEY=...` | enables the Gemini adjudicator / assessments / live grounded drill-down |
| `GEMINI_MODEL=gemini-2.5-flash` | override the Gemini model |
| `VITE_API_BASE=...` | (frontend build) backend URL in production |

> **Keys are read from the environment only** and never committed. Copy them into
> a local `.env` (gitignored) or your host's secret manager. The app runs fully
> with **no keys** — LLM-powered features degrade gracefully (deterministic
> adjudication, rule-based assessments, data-only chart drill-down,
> template-based action drafts).

### Choosing the live analysis engine

The **build-time** adjudicator/assessment backend is set by the env vars above
(the prebuilt `dashboard.json` is not re-crawled at request time). The **live**
LLM features — the chart drill-down and the semi-automated action drafting —
read a separate, switchable engine you can change at runtime on the **Scoring**
page (Deterministic / Claude / Gemini / Auto). `GET /api/providers` reports which
keys are configured.
