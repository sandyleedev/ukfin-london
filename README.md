# Sentinel — FCA Supervision Intelligence

An early-warning system that mines the **CFPB Consumer Complaint Database** for
**AI / automation-driven consumer harm**, clusters it into recurring patterns,
and ranks those patterns so a regulator can see *what to act on first* — striking
the balance between consumer protection and financial innovation.

## The pipeline (workflow)

```
CFPB API  ─►  Stage 1: candidate filter   ─►  Stage 2: adjudication   ─►
              (likelihood × narrative          (LLM via Claude, or a
               signal — high recall)            deterministic score)

          ─►  Stage 3: clustering          ─►  Stage 4: scoring + alerts
              (TF-IDF + KMeans, unsupervised    (weighted priority, severity,
               harm-pattern discovery)           status, live alerts, trend)

          ─►  dashboard.json  ─►  FastAPI  ─►  React dashboard
```

**Why clustering, not random forest:** we have no labelled training data telling
us which harm pattern a complaint belongs to — the goal is to *discover* the
patterns. That is an unsupervised problem, so we cluster (TF-IDF + KMeans, k
chosen by silhouette). Random forest is supervised and would need labels we
don't have.

**Priority score** (transparent, tunable weights):
`0.28·frequency + 0.33·severity + 0.22·growth + 0.17·regulatory_relevance`.

## Layout

```
Sentinel/
├── backend/        Python pipeline + FastAPI
│   ├── cfpb_client.py        CFPB fetcher (month-chunked, retry/backoff)
│   ├── ai_filter.py          Stage 1: two-signal candidate filter
│   ├── llm_adjudicator.py    Stage 2: LLM (Claude) or deterministic score
│   ├── cluster.py            Stage 3: TF-IDF + KMeans clustering
│   ├── scoring.py            Stage 4: priority, severity, alerts, trend
│   ├── build_dashboard.py    orchestrator → output/dashboard.json
│   ├── api.py                FastAPI serving the dashboard
│   └── output/               dashboard.json  (raw_cache.json is gitignored — see below)
└── frontend/       Vite + React + Tailwind + recharts dashboard
```

## Run it

**Backend** (port 8050 — the frontend proxies `/api` here):
```bash
cd backend
pip install -r requirements.txt

# First run: crawl 6 months of real CFPB data (~2 min, ~127k complaints)
REFRESH=1 python build_dashboard.py

# Subsequent runs: uses the local cache (fast, no network)
python build_dashboard.py

uvicorn api:app --reload --port 8050
```

> **Why is `raw_cache.json` missing?**  
> The raw CFPB crawl cache is `~200 MB` — over GitHub's 100 MB file limit — so it is
> gitignored and not committed. Run `REFRESH=1 python build_dashboard.py` once to
> fetch it locally; all subsequent runs use the cached version automatically.

**Frontend** (port 5173):
```bash
cd frontend
npm install
npm run dev          # open http://localhost:5173
```

## Options

| Env var | Effect |
|---|---|
| `REFRESH=1` | force a fresh CFPB crawl instead of using `output/raw_cache.json` |
| `MONTHS_BACK=6` | crawl depth in months (default 6) |
| `ADJUDICATE_BACKEND=llm\|score\|auto` | Stage 2 backend (`auto` = LLM if `ANTHROPIC_API_KEY` set, else deterministic score) |
| `ANTHROPIC_API_KEY=...` | enables the Claude adjudicator (best recall on implied-automation cases) |
| `ADJUDICATE_MAX=50` | cap LLM calls (cost control) |
| `REGUTRIAGE_LLM_MODEL=claude-haiku-4-5` | cheaper/faster adjudication model (default `claude-opus-4-8`) |
