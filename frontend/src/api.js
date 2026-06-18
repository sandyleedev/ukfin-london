// Thin fetch wrapper for the ReguLens backend.
//
// In dev, /api is proxied to the FastAPI server by vite (see vite.config.js).
// In production (e.g. Vercel), set VITE_API_BASE to the deployed backend URL
// (e.g. https://regulens-api.onrender.com) at build time.
const API_BASE = import.meta.env.VITE_API_BASE || "";

async function getJSON(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (res.status === 503) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Dashboard not built yet — run build_dashboard.py");
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export function fetchDashboard() {
  return getJSON("/api/dashboard");
}

export function fetchCases(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== "" && v != null && v !== "ALL")
  ).toString();
  return getJSON(`/api/cases${qs ? `?${qs}` : ""}`);
}

export async function rescore(weights) {
  const res = await fetch(`${API_BASE}/api/rescore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(weights),
  });
  if (!res.ok) throw new Error(`Rescore failed ${res.status}`);
  return res.json();
}

async function postJSON(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `API error ${res.status}`);
  }
  return res.json();
}

// Item 4 — alert methodology reference.
export function fetchMethodology() {
  return getJSON("/api/methodology");
}

// Item 5 — live chart drill-down (real cases + best-effort web news).
export function fetchDrilldown(date) {
  return getJSON(`/api/drilldown?date=${encodeURIComponent(date)}`);
}

// Item 7 — analysis-engine selection.
export function fetchProviders() {
  return getJSON("/api/providers");
}
export function setAnalysisEngine(engine) {
  return postJSON("/api/analysis-config", { engine });
}

// Item 7b — persist customer-tuned priority weights (CRUD).
export function fetchWeights() {
  return getJSON("/api/weights");
}
export async function saveWeights(weights) {
  const res = await fetch(`${API_BASE}/api/weights`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(weights),
  });
  if (!res.ok) throw new Error(`Save weights failed ${res.status}`);
  return res.json();
}
export async function resetWeights() {
  const res = await fetch(`${API_BASE}/api/weights`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Reset weights failed ${res.status}`);
  return res.json();
}
export function fetchConfig() {
  return getJSON("/api/config");
}
export async function saveConfig(reg_relevance) {
  const res = await fetch(`${API_BASE}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reg_relevance }),
  });
  if (!res.ok) throw new Error(`Save config failed ${res.status}`);
  return res.json();
}
export async function resetConfig() {
  const res = await fetch(`${API_BASE}/api/config`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Reset config failed ${res.status}`);
  return res.json();
}

// Item 6 — semi-automated supervisory actions (draft + simulated send).
export function draftAction(cluster_id, action) {
  return postJSON("/api/draft-action", { cluster_id, action });
}
export function sendAction(payload) {
  return postJSON("/api/send-action", payload);
}
export function fetchOutbox() {
  return getJSON("/api/outbox");
}
