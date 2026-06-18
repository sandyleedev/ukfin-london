"""
llm_providers.py — central provider layer for ReguLens.

ReguLens can reason with two LLM providers, plus a zero-cost deterministic
fallback:

  • "claude"  — Anthropic Claude (needs ANTHROPIC_API_KEY)
  • "gemini"  — Google Gemini (needs GOOGLE_API_KEY / GEMINI_API_KEY)
  • "score"   — no LLM; deterministic / rule-based logic elsewhere in the pipeline

This module owns three things so the rest of the codebase doesn't re-implement
them:

  1. Provider availability      → which keys are configured right now.
  2. The *live* engine selection → a single persisted choice (output/
     analysis_config.json) that the runtime LLM features (chart drill-down,
     action drafting) honour. NOTE: the build-time adjudicator/assessment
     backends are still chosen by their own env vars — the prebuilt
     dashboard.json is not re-crawled live.
  3. Thin call helpers           → structured JSON generation and best-effort
     web research, for whichever provider is selected, with graceful fallback.

Everything here is defensive: if a key is missing, an SDK isn't installed, or a
call fails, helpers return None rather than raising, so callers can degrade to a
data-only / rule-based path and the app keeps working with no keys at all.
"""

import json
import logging
import os
from typing import Dict, List, Optional

logger = logging.getLogger("llm_providers")

ANTHROPIC_MODEL = os.environ.get("REGUTRIAGE_LLM_MODEL", "claude-opus-4-8")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

VALID_ENGINES = ("auto", "score", "claude", "gemini")

_HERE = os.path.dirname(os.path.abspath(__file__))
_CONFIG_PATH = os.path.join(_HERE, "output", "analysis_config.json")


# ---------------------------------------------------------------------------
# Availability
# ---------------------------------------------------------------------------

def google_key() -> Optional[str]:
    return os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")


def have_anthropic() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def have_google() -> bool:
    return bool(google_key())


def providers_status() -> Dict:
    """For GET /api/providers — what's configured and what's selected."""
    return {
        "selected": selected_engine(),
        "resolved": resolve_engine(),
        "providers": {
            "score": {"available": True, "label": "Deterministic (no LLM)",
                      "model": None},
            "claude": {"available": have_anthropic(), "label": "Anthropic Claude",
                       "model": ANTHROPIC_MODEL if have_anthropic() else None},
            "gemini": {"available": have_google(), "label": "Google Gemini",
                       "model": GEMINI_MODEL if have_google() else None},
        },
    }


# ---------------------------------------------------------------------------
# Live engine selection (persisted)
# ---------------------------------------------------------------------------

def selected_engine() -> str:
    try:
        with open(_CONFIG_PATH, "r", encoding="utf-8") as fh:
            eng = json.load(fh).get("engine", "auto")
            return eng if eng in VALID_ENGINES else "auto"
    except (OSError, json.JSONDecodeError):
        return "auto"


def set_engine(engine: str) -> str:
    if engine not in VALID_ENGINES:
        raise ValueError(f"engine must be one of {VALID_ENGINES}")
    os.makedirs(os.path.dirname(_CONFIG_PATH), exist_ok=True)
    with open(_CONFIG_PATH, "w", encoding="utf-8") as fh:
        json.dump({"engine": engine}, fh)
    return engine


def resolve_engine(engine: Optional[str] = None) -> str:
    """Turn 'auto' (or None) into a concrete, *available* engine."""
    eng = engine or selected_engine()
    if eng == "auto":
        if have_anthropic():
            return "claude"
        if have_google():
            return "gemini"
        return "score"
    # Asked for a provider that has no key → fall back to score.
    if eng == "claude" and not have_anthropic():
        return "score"
    if eng == "gemini" and not have_google():
        return "score"
    return eng


# ---------------------------------------------------------------------------
# Gemini structured JSON (best effort)
# ---------------------------------------------------------------------------

def gemini_json(system: str, user: str, max_tokens: int = 1200) -> Optional[dict]:
    """Ask Gemini for a JSON object. Returns the parsed dict, or None on any
    failure (missing key/SDK, network error, unparseable output)."""
    if not have_google():
        return None
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=google_key())
        resp = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                max_output_tokens=max_tokens,
                temperature=0.2,
            ),
        )
        return json.loads(resp.text)
    except Exception as exc:  # noqa: BLE001 — degrade gracefully
        logger.warning("gemini_json failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Web research (best effort) — returns synthesis + real source links
# ---------------------------------------------------------------------------

def web_research(query: str, engine: Optional[str] = None,
                 max_tokens: int = 900) -> Optional[Dict]:
    """
    Run a grounded web search for `query` using the resolved provider and return
    {"narrative": str, "news": [{"headline","url","source"}], "provider": str}.

    Returns None when no LLM provider is available or the call fails, so the
    caller can fall back to a data-only summary.
    """
    eng = resolve_engine(engine)
    if eng == "claude":
        return _claude_web(query, max_tokens)
    if eng == "gemini":
        return _gemini_web(query, max_tokens)
    return None


def _claude_web(query: str, max_tokens: int) -> Optional[Dict]:
    if not have_anthropic():
        return None
    try:
        import anthropic
        client = anthropic.Anthropic()
        resp = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=max_tokens,
            tools=[{"type": "web_search_20250305", "name": "web_search",
                    "max_uses": 4}],
            messages=[{"role": "user", "content": query}],
        )
        return _parse_anthropic_web(resp)
    except Exception as exc:  # noqa: BLE001
        logger.warning("_claude_web failed: %s", exc)
        return None


def _parse_anthropic_web(resp) -> Dict:
    """Pull the assistant text and any web-search source citations from a
    Claude web-search response."""
    narrative_parts: List[str] = []
    news: List[Dict] = []
    seen = set()
    for block in resp.content:
        btype = getattr(block, "type", None)
        if btype == "text":
            text = getattr(block, "text", "") or ""
            narrative_parts.append(text)
            for cit in (getattr(block, "citations", None) or []):
                url = getattr(cit, "url", None)
                if url and url not in seen:
                    seen.add(url)
                    news.append({"headline": getattr(cit, "title", None) or url,
                                 "url": url, "source": _domain(url)})
        elif btype == "web_search_tool_result":
            for item in (getattr(block, "content", None) or []):
                url = getattr(item, "url", None)
                if url and url not in seen:
                    seen.add(url)
                    news.append({"headline": getattr(item, "title", None) or url,
                                 "url": url, "source": _domain(url)})
    return {"narrative": "\n".join(p for p in narrative_parts if p).strip(),
            "news": news[:6], "provider": "claude"}


def _gemini_web(query: str, max_tokens: int) -> Optional[Dict]:
    if not have_google():
        return None
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=google_key())
        resp = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=query,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                max_output_tokens=max_tokens,
                temperature=0.2,
            ),
        )
        return _parse_gemini_web(resp)
    except Exception as exc:  # noqa: BLE001
        logger.warning("_gemini_web failed: %s", exc)
        return None


def _parse_gemini_web(resp) -> Dict:
    narrative = (getattr(resp, "text", "") or "").strip()
    news: List[Dict] = []
    seen = set()
    try:
        cand = resp.candidates[0]
        meta = getattr(cand, "grounding_metadata", None)
        for chunk in (getattr(meta, "grounding_chunks", None) or []):
            web = getattr(chunk, "web", None)
            url = getattr(web, "uri", None) if web else None
            if url and url not in seen:
                seen.add(url)
                news.append({"headline": getattr(web, "title", None) or url,
                             "url": url, "source": _domain(getattr(web, "title", "") or url)})
    except (AttributeError, IndexError):
        pass
    return {"narrative": narrative, "news": news[:6], "provider": "gemini"}


def _domain(url_or_title: str) -> str:
    s = str(url_or_title or "")
    if "://" in s:
        s = s.split("://", 1)[1]
    return s.split("/", 1)[0].replace("www.", "") or "web"
