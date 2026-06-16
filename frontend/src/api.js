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
