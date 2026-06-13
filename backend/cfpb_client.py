"""
cfpb_client.py
==============
Fetches consumer complaints from the CFPB Consumer Complaint Database (CCDB)
public API: https://cfpb.github.io/api/ccdb/api.html

Design decisions:
- We pull the last few months of data (default 6 — see MONTHS_BACK). The CCDB
  API caps a single response at `size` records and uses a `from` offset for
  pagination, but very wide date ranges can time out or silently truncate, and
  older complete months run to ~100k+ narratives each. To stay tractable we
  *chunk the request by calendar month* and paginate within each month.
- Network calls are wrapped with tenacity-based retries (exponential backoff)
  so transient timeouts / 5xx errors don't kill a multi-month crawl.
- Only the fields we actually need downstream are retained, keeping the cache
  small and the AI filter fast.
"""

import json
import logging
import os
from datetime import date, datetime
from typing import Dict, List

import requests
from dateutil.relativedelta import relativedelta  # robust month arithmetic
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Public search endpoint. The `/` (search) route accepts the query params
# documented in the CCDB API and returns Elasticsearch-style hits.
CFPB_API_URL = "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/"

# How far back to crawl, in calendar months. Six months gives enough history
# for the >30-day signals (PERSISTENT status, growth baselines, the trend
# chart) while keeping the crawl tractable — older complete months are large
# (~100k+ narratives each), so a multi-year pull is impractical here.
MONTHS_BACK = 6

# Page size per request. 1000 is the documented practical maximum.
PAGE_SIZE = 1000

# Network timeout per request (seconds). Generous because some month chunks
# are large and the server can be slow to assemble them.
REQUEST_TIMEOUT = 60

# The only fields we keep per complaint. Everything else is discarded to keep
# the cache lean. Keys here are the *output* field names; the mapping below
# translates the API's raw field names into these.
KEEP_FIELDS = [
    "complaint_id",
    "date_received",
    "product",
    "sub_product",
    "issue",
    "consumer_complaint_narrative",
    "company",
    "state",
    "submitted_via",
    "company_response_to_consumer",
    "timely_response",
]

# Maps our clean field name -> the CCDB API's raw `_source` field name.
# Most are identical, but a few differ (e.g. the API uses `complaint_what_happened`
# for the free-text narrative and `complaint_id` is sometimes only in `_id`).
API_FIELD_MAP = {
    "complaint_id": "complaint_id",
    "date_received": "date_received",
    "product": "product",
    "sub_product": "sub_product",
    "issue": "issue",
    "consumer_complaint_narrative": "complaint_what_happened",
    "company": "company",
    "state": "state",
    "submitted_via": "submitted_via",
    "company_response_to_consumer": "company_response",
    "timely_response": "timely",
}

logger = logging.getLogger("cfpb_client")


# ---------------------------------------------------------------------------
# Low-level HTTP with retry / backoff
# ---------------------------------------------------------------------------

class TransientAPIError(Exception):
    """Raised for 5xx responses so tenacity knows to retry them."""


@retry(
    # Retry up to 3 attempts total on timeouts, connection errors, or our
    # explicit TransientAPIError (raised for 5xx). 4xx errors are NOT retried
    # because they indicate a client-side problem that won't fix itself.
    retry=retry_if_exception_type(
        (requests.exceptions.Timeout,
         requests.exceptions.ConnectionError,
         TransientAPIError)
    ),
    stop=stop_after_attempt(3),
    # Exponential backoff: ~2s, 4s, 8s (capped at 30s).
    wait=wait_exponential(multiplier=2, min=2, max=30),
    reraise=True,
)
def _get_page(params: Dict) -> Dict:
    """
    Perform a single GET request for one page of results.

    Returns the parsed JSON dict. Raises TransientAPIError on 5xx so the
    tenacity decorator retries with backoff.
    """
    resp = requests.get(CFPB_API_URL, params=params, timeout=REQUEST_TIMEOUT)

    # 5xx -> transient; raise so we retry.
    if 500 <= resp.status_code < 600:
        raise TransientAPIError(f"Server error {resp.status_code} from CFPB API")

    # 4xx -> permanent client error; surface immediately (no retry).
    resp.raise_for_status()

    return resp.json()


# ---------------------------------------------------------------------------
# Field extraction
# ---------------------------------------------------------------------------

def _extract_complaint(hit: Dict) -> Dict:
    """
    Flatten a single Elasticsearch hit into our trimmed complaint dict.

    The CCDB API nests the real data under `_source`, with `_id` holding the
    complaint id. We map raw field names to our clean names and default any
    missing field to None.
    """
    source = hit.get("_source", {}) or {}

    record = {}
    for clean_name, raw_name in API_FIELD_MAP.items():
        record[clean_name] = source.get(raw_name)

    # The complaint id is most reliably found in the hit's `_id`; fall back to
    # the source field if present.
    if not record.get("complaint_id"):
        record["complaint_id"] = hit.get("_id") or source.get("complaint_id")

    return record


# ---------------------------------------------------------------------------
# Month chunking
# ---------------------------------------------------------------------------

def _month_ranges(start: date, end: date) -> List[tuple]:
    """
    Yield (min_date, max_date) tuples, one per calendar month, covering
    [start, end]. Each tuple is a half-open-ish window: the first day of the
    month through the first day of the *next* month, which the CCDB API treats
    as inclusive-min / exclusive-max via date_received_max.

    Returned dates are ISO strings (YYYY-MM-DD).
    """
    ranges = []
    cursor = date(start.year, start.month, 1)
    while cursor <= end:
        next_month = cursor + relativedelta(months=1)
        # Cap the final window at `end` so we don't fetch into the future.
        window_max = min(next_month, end + relativedelta(days=1))
        ranges.append((cursor.isoformat(), window_max.isoformat()))
        cursor = next_month
    return ranges


# ---------------------------------------------------------------------------
# Public fetch API
# ---------------------------------------------------------------------------

def fetch_complaints(months_back: int = MONTHS_BACK,
                     narrative_only: bool = True) -> List[Dict]:
    """
    Fetch the last `months_back` months of complaints, chunked by calendar month.

    IMPORTANT — how this endpoint actually behaves:
    The CCDB v1 search API with `format=json` returns a *flat JSON list* of
    Elasticsearch-style hit objects (each with `_id` and `_source`). It does
    NOT honour `size` / `from` — a single request returns *every* record that
    matches the date range. Empirically a single month of all products is
    ~150k rows. We therefore:
      * chunk by month purely to bound each individual response payload, and
      * make exactly ONE request per month (no inner pagination loop, since
        paging params are ignored).

    `narrative_only=True` adds `has_narrative=true`, filtering server-side to
    complaints that actually have a free-text narrative. This is the only field
    the AI filter inspects, and the pipeline drops empty-narrative rows anyway,
    so it's behaviourally identical to fetching everything — but ~3x less data
    (~45k vs ~150k per month), which keeps the crawl tractable.

    Returns a flat list of trimmed complaint dicts (see KEEP_FIELDS).
    """
    end = date.today()
    start = end - relativedelta(months=months_back)

    month_windows = _month_ranges(start, end)
    logger.info(
        "Fetching CFPB complaints from %s to %s across %d monthly chunks "
        "(narrative_only=%s)",
        start.isoformat(), end.isoformat(), len(month_windows), narrative_only,
    )

    all_complaints: List[Dict] = []

    for idx, (date_min, date_max) in enumerate(month_windows, start=1):
        month_label = date_min[:7]  # YYYY-MM

        logger.info("[%d/%d] Fetching month %s ...",
                    idx, len(month_windows), month_label)

        params = {
            "date_received_min": date_min,
            "date_received_max": date_max,
            "field": "all",
            "format": "json",
            # size/from are accepted but ignored by the JSON-list endpoint;
            # left here as documentation of intent / future-proofing.
            "size": PAGE_SIZE,
            "from": 0,
        }
        if narrative_only:
            params["has_narrative"] = "true"

        payload = _get_page(params)

        # The endpoint returns a bare list. Stay defensive: also accept the
        # Elasticsearch `hits.hits` shape in case the API changes.
        if isinstance(payload, list):
            hits = payload
        elif isinstance(payload, dict):
            hits = payload.get("hits", {}).get("hits", [])
        else:
            hits = []

        for hit in hits:
            all_complaints.append(_extract_complaint(hit))

        logger.info("[%d/%d] Month %s done: %d complaints (running total: %d)",
                    idx, len(month_windows), month_label,
                    len(hits), len(all_complaints))

    logger.info("Fetch complete: %d total complaints", len(all_complaints))
    return all_complaints


# ---------------------------------------------------------------------------
# Optional raw cache
# ---------------------------------------------------------------------------

def save_raw_cache(data: List[Dict], filepath: str) -> None:
    """
    Persist the raw fetched complaints to disk as JSON so dev iterations can
    skip the (slow) API crawl. Creates parent directories as needed.
    """
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    logger.info("Saved raw cache: %s (%d records)", filepath, len(data))


def load_raw_cache(filepath: str) -> List[Dict]:
    """Load a previously saved raw cache. Returns [] if the file is missing."""
    if not os.path.exists(filepath):
        return []
    with open(filepath, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    logger.info("Loaded raw cache: %s (%d records)", filepath, len(data))
    return data


if __name__ == "__main__":
    # Quick manual smoke test: fetch a small slice and print a sample.
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    sample = fetch_complaints(months_back=1)
    print(f"Fetched {len(sample)} complaints")
    if sample:
        print(json.dumps(sample[0], indent=2))
