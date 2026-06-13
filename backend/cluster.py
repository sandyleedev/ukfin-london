"""
cluster.py — Sentinel Stage 3: cluster confirmed AI-related complaints into
recurring harm patterns.

Why clustering (unsupervised) and NOT random forest (supervised):
  A random forest predicts a *known* label from features — it needs a training
  set where each complaint is already tagged with its harm pattern. We have no
  such labels: the whole point is to *discover* which patterns exist. That is an
  unsupervised problem, so we cluster.

Method (chosen for regulator-facing interpretability):
  1. Group complaints by CFPB product → a coherent regulatory category.
  2. Within each category, TF-IDF–vectorise the narratives (1–2 grams, English
     stopwords) and cluster with KMeans. k is chosen by silhouette score over a
     small candidate range, so we don't hand-pick the number of patterns.
  3. Small categories (below the clustering floor) become a single cluster.
  4. Each cluster is auto-labelled from its top TF-IDF terms and tagged with
     real metrics: case count, member companies, first/last activity, and
     7-day growth computed from actual date_received timestamps.

The output feeds scoring.py (priority ranking + alerts + trend).
"""

import logging
import re
from collections import Counter
from datetime import datetime
from typing import Dict, List

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics import silhouette_score

logger = logging.getLogger("cluster")

# Below this many complaints, a category is treated as one cluster (too small
# to sub-divide meaningfully).
MIN_FOR_SUBCLUSTERING = 8
# Target ~this many complaints per sub-cluster when choosing k.
TARGET_PER_CLUSTER = 6
MAX_K = 5

# Map verbose CFPB product strings → short, regulator-friendly categories.
CATEGORY_MAP = [
    ("credit reporting", "Credit Reporting"),
    ("debt collection", "Debt Collection"),
    ("checking or savings", "Banking"),
    ("credit card", "Cards & Payments"),
    ("prepaid card", "Cards & Payments"),
    ("mortgage", "Mortgages"),
    ("money transfer", "Payments & Crypto"),
    ("virtual currency", "Payments & Crypto"),
    ("vehicle loan", "Auto Lending"),
    ("payday loan", "Consumer Credit"),
    ("personal loan", "Consumer Credit"),
    ("student loan", "Student Lending"),
]

# Domain stopwords on top of English: extremely common complaint boilerplate
# that would otherwise dominate every cluster label.
EXTRA_STOPWORDS = {
    "xxxx", "xx", "account", "company", "bank", "credit", "consumer", "report",
    "told", "said", "called", "received", "would", "could", "also", "back",
    "day", "days", "time", "money", "did", "didnt", "im", "ive", "dont",
    "card", "payment", "loan", "information", "company", "number", "letter",
}


def _category(product) -> str:
    p = str(product or "").lower()
    for key, cat in CATEGORY_MAP:
        if key in p:
            return cat
    return "Other"


def _parse_dt(value):
    """Parse CFPB ISO timestamps like '2024-01-04T20:03:27.000Z'."""
    if not value:
        return None
    s = str(value).replace("Z", "").split(".")[0]
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:19] if "T" in s else s[:10], fmt)
        except ValueError:
            continue
    return None


def _label_from_terms(vectorizer, centroid_row, issue_hint: str) -> str:
    """Build a human-readable cluster label from top TF-IDF terms + the modal issue."""
    terms = np.asarray(vectorizer.get_feature_names_out())
    top_idx = np.argsort(centroid_row)[::-1][:4]
    keywords = [terms[i] for i in top_idx if centroid_row[i] > 0]
    phrase = ", ".join(k.title() for k in keywords[:3]) if keywords else "General"
    issue = (issue_hint or "").strip()
    if issue and issue.lower() not in phrase.lower():
        return f"{phrase} — {issue}"
    return phrase


def _choose_k(n: int) -> int:
    return max(2, min(MAX_K, round(n / TARGET_PER_CLUSTER)))


def _growth_7d(dates: List[datetime], as_of: datetime) -> float:
    """
    Percent change in case volume: last 7 days vs the preceding 7 days.
    Returns a percentage (e.g. 312.0 for +312%). Capped for display sanity.
    """
    if not dates:
        return 0.0
    last7 = sum(1 for d in dates if d and (as_of - d).days < 7)
    prev7 = sum(1 for d in dates if d and 7 <= (as_of - d).days < 14)
    if prev7 == 0:
        # No prior-week baseline: all activity is new. Report a fixed +100%
        # ("all new") rather than scaling by count — the old `100 * last7`
        # turned a single new complaint into a misleading +500% spike.
        return 100.0 if last7 else 0.0
    return round((last7 - prev7) / prev7 * 100.0, 1)


def _daily_counts(dates: List[datetime], as_of: datetime, window: int = 90) -> List[int]:
    """Per-day case counts over the trailing `window` days (oldest→newest).

    Feeds the dashboard's alert-volume trend (scoring.build_trend), so the
    window here must match build_trend's. 90 days surfaces a few months of
    history once a multi-month crawl is in place.
    """
    buckets = [0] * window
    for d in dates:
        if not d:
            continue
        delta = (as_of.date() - d.date()).days
        if 0 <= delta < window:
            buckets[window - 1 - delta] += 1
    return buckets


def build_clusters(df: pd.DataFrame) -> List[Dict]:
    """
    Cluster the confirmed AI-related complaints and return a list of cluster
    dicts with real, data-driven metrics. `df` must contain at least
    consumer_complaint_narrative, product, company, date_received, confidence.
    """
    if df is None or df.empty:
        return []

    df = df.copy()
    df["category"] = df["product"].apply(_category)
    df["_dt"] = df["date_received"].apply(_parse_dt)
    # "Now" = the most recent complaint in the dataset (keeps growth windows
    # meaningful even when running against a static cache).
    valid_dts = [d for d in df["_dt"] if d is not None]
    as_of = max(valid_dts) if valid_dts else datetime.utcnow()

    clusters: List[Dict] = []
    cid = 0

    for category, grp in df.groupby("category"):
        grp = grp.reset_index(drop=True)
        narratives = grp["consumer_complaint_narrative"].astype(str).tolist()

        # Decide sub-clusters within this category.
        if len(grp) < MIN_FOR_SUBCLUSTERING:
            labels = np.zeros(len(grp), dtype=int)
            vectorizer = None
            centroids = None
        else:
            vectorizer = TfidfVectorizer(
                ngram_range=(1, 2), min_df=2, max_df=0.9, max_features=400,
                stop_words=list(ENGLISH_STOP_WORDS | EXTRA_STOPWORDS),
                # Alphabetic tokens of length >=3 only — drops "00", "xx", IDs.
                token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]{2,}\b",
            )
            try:
                X = vectorizer.fit_transform(narratives)
            except ValueError:
                X = None
            if X is None or X.shape[1] < 2:
                labels = np.zeros(len(grp), dtype=int)
                vectorizer = None
                centroids = None
            else:
                k = _choose_k(len(grp))
                # Pick k by silhouette over a small range when we have room.
                best_k, best_s, best_labels, best_model = k, -1.0, None, None
                for cand in range(2, min(MAX_K, len(grp) - 1) + 1):
                    km = KMeans(n_clusters=cand, n_init=5, random_state=42)
                    lab = km.fit_predict(X)
                    if len(set(lab)) < 2:
                        continue
                    try:
                        s = silhouette_score(X, lab)
                    except ValueError:
                        s = -1.0
                    if s > best_s:
                        best_k, best_s, best_labels, best_model = cand, s, lab, km
                if best_labels is None:
                    km = KMeans(n_clusters=k, n_init=5, random_state=42)
                    best_labels = km.fit_predict(X)
                    best_model = km
                labels = best_labels
                centroids = best_model.cluster_centers_
                logger.info("Category '%s': %d complaints → %d sub-clusters "
                            "(silhouette=%.2f)", category, len(grp),
                            len(set(labels)), best_s)

        # Materialise each sub-cluster.
        for lab in sorted(set(labels)):
            members = grp[labels == lab]
            dates = [d for d in members["_dt"].tolist() if d is not None]
            companies = [c for c in members["company"].tolist() if c]
            comp_counts = Counter(companies).most_common(3)
            issue_hint = (members["issue"].mode().iloc[0]
                          if "issue" in members and not members["issue"].mode().empty else "")

            if vectorizer is not None and centroids is not None:
                name = _label_from_terms(vectorizer, centroids[lab], issue_hint)
            else:
                name = (issue_hint or category)

            clusters.append({
                "id": f"CL-{cid:03d}",
                "name": f"{category} — {name}" if name and category not in name else name or category,
                "category": category,
                "cases": int(len(members)),
                "companies": [c for c, _ in comp_counts],
                "growth_7d": _growth_7d(dates, as_of),
                "first_seen": min(dates).isoformat() if dates else None,
                "last_activity": max(dates).isoformat() if dates else None,
                "daily_counts": _daily_counts(dates, as_of),
                "sample_narratives": members["consumer_complaint_narrative"]
                    .astype(str).str.slice(0, 240).head(3).tolist(),
                "matched_signals": sorted({s for sigs in members.get("matched_signals", [])
                                           for s in (sigs or [])}),
                "matched_keywords": sorted({k for kws in members.get("matched_keywords", [])
                                            for k in (kws or [])}),
            })
            cid += 1

    logger.info("Built %d clusters across %d categories.",
                len(clusters), df["category"].nunique())
    return clusters
