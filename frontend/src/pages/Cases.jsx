import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, CheckCircle2, RotateCcw, ChevronDown, Building2, Calendar, Hash, X } from "lucide-react";
import { useDashboard } from "../DataContext.jsx";
import { fetchCases } from "../api.js";
import { Panel, SeverityBadge, fmtTime } from "../ui.jsx";

const CLOSED_KEY = "regulens_closed_cases";

function loadClosed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLOSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export default function Cases() {
  const { data } = useDashboard();
  const [params, setParams] = useSearchParams();

  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const [clusterId, setClusterId] = useState(params.get("cluster_id") || "ALL");
  const [category, setCategory] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | OPEN | CLOSED
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [closed, setClosed] = useState(loadClosed);

  // Debounce the free-text search box.
  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch), 300);
    return () => clearTimeout(t);
  }, [rawSearch]);

  // Keep cluster_id in the URL so deep-links from the drawer survive refresh.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (clusterId === "ALL") next.delete("cluster_id");
    else next.set("cluster_id", clusterId);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId]);

  useEffect(() => {
    setLoading(true);
    fetchCases({ q: search, cluster_id: clusterId, category, limit: 2000 })
      .then((r) => {
        setCases(r.cases);
        setTotal(r.total);
      })
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, [search, clusterId, category]);

  const persistClosed = (set) => {
    localStorage.setItem(CLOSED_KEY, JSON.stringify([...set]));
    setClosed(new Set(set));
  };

  const toggleClose = (id) => {
    const next = new Set(closed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persistClosed(next);
  };

  const categories = useMemo(() => {
    const cats = new Set((data?.clusters || []).map((c) => c.category).filter(Boolean));
    return ["ALL", ...[...cats].sort()];
  }, [data]);

  const visible = useMemo(() => {
    return cases.filter((c) => {
      if (statusFilter === "OPEN") return !closed.has(c.complaint_id);
      if (statusFilter === "CLOSED") return closed.has(c.complaint_id);
      return true;
    });
  }, [cases, statusFilter, closed]);

  const openCount = cases.filter((c) => !closed.has(c.complaint_id)).length;
  const closedCount = cases.length - openCount;

  const activeClusterName =
    clusterId !== "ALL"
      ? data?.clusters.find((c) => c.id === clusterId)?.name || clusterId
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-ink">Case Explorer</h1>
        <p className="text-sm text-muted mt-1">
          Every individual CFPB complaint behind the clusters. Search, triage, and close cases as they are actioned.
        </p>
      </div>

      {/* Stat chips */}
      <div className="flex gap-4">
        <Stat label="Matching cases" value={total.toLocaleString()} />
        <Stat label="Open" value={openCount.toLocaleString()} accent="#ea580c" />
        <Stat label="Closed" value={closedCount.toLocaleString()} accent="#059669" />
      </div>

      <Panel
        title="Cases"
        subtitle={
          activeClusterName ? (
            <span className="flex items-center gap-2 mt-1">
              Filtered to cluster: <span className="text-brand font-medium">{activeClusterName}</span>
              <button onClick={() => setClusterId("ALL")} className="text-muted hover:text-ink">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ) : (
            `${visible.length} shown`
          )
        }
        className="h-full"
      >
        {/* Filter strip */}
        <div className="px-6 py-4 border-b border-line/20 bg-white/40 flex flex-wrap items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search narrative, firm, issue, ID…"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-white/70 border border-line/30 rounded-xl focus:outline-none focus:border-brand/70 focus:ring-1 focus:ring-brand/30 transition-all w-72"
            />
            <Search className="w-4 h-4 text-muted/60 absolute left-3 top-2.5 pointer-events-none" />
          </div>

          <Select value={clusterId} onChange={setClusterId}>
            <option value="ALL">All clusters</option>
            {(data?.clusters || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <Select value={category} onChange={setCategory}>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat === "ALL" ? "All categories" : cat}</option>
            ))}
          </Select>

          <Select value={statusFilter} onChange={setStatusFilter}>
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open only</option>
            <option value="CLOSED">Closed only</option>
          </Select>
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted text-sm">Loading cases…</div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm">No matching cases.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white/90 backdrop-blur-xl z-10">
              <tr className="text-xs uppercase tracking-wider text-muted">
                <th className="font-semibold px-6 py-3 border-b border-line/30">Complaint</th>
                <th className="font-semibold px-6 py-3 border-b border-line/30">Firm</th>
                <th className="font-semibold px-6 py-3 border-b border-line/30">Issue</th>
                <th className="font-semibold px-6 py-3 border-b border-line/30">Severity</th>
                <th className="font-semibold px-6 py-3 border-b border-line/30">Status</th>
                <th className="font-semibold px-6 py-3 border-b border-line/30 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c, idx) => {
                const isClosed = closed.has(c.complaint_id);
                const isOpen = expanded === c.complaint_id;
                return (
                  <CaseRow
                    key={`${c.complaint_id}-${idx}`}
                    c={c}
                    isClosed={isClosed}
                    isExpanded={isOpen}
                    onToggleExpand={() => setExpanded(isOpen ? null : c.complaint_id)}
                    onToggleClose={() => toggleClose(c.complaint_id)}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function CaseRow({ c, isClosed, isExpanded, onToggleExpand, onToggleClose }) {
  return (
    <>
      <tr
        onClick={onToggleExpand}
        className={`text-sm cursor-pointer border-b border-line/20 transition-all duration-200 ${
          isClosed ? "opacity-50 bg-low/[0.03]" : "hover:bg-accent/40"
        }`}
      >
        <td className="px-6 py-3.5">
          <div className="flex items-center gap-2 font-mono text-xs text-muted">
            <Hash className="w-3 h-3" /> {c.complaint_id}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted/70 mt-1">
            <Calendar className="w-3 h-3" /> {fmtTime(c.date_received)}
          </div>
        </td>
        <td className="px-6 py-3.5">
          <div className="flex items-center gap-1.5 text-ink font-medium">
            <Building2 className="w-3.5 h-3.5 text-muted" /> {c.company || "—"}
          </div>
          <div className="text-xs text-brand mt-1">{c.category}</div>
        </td>
        <td className="px-6 py-3.5 max-w-[260px]">
          <div className="text-ink truncate">{c.issue || "—"}</div>
          <div className="text-xs text-muted truncate mt-1">{c.cluster_name}</div>
        </td>
        <td className="px-6 py-3.5"><SeverityBadge band={c.severity_band} /></td>
        <td className="px-6 py-3.5">
          {isClosed ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-low">
              <CheckCircle2 className="w-3.5 h-3.5" /> Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-high">
              <span className="w-1.5 h-1.5 rounded-full bg-high" /> Open
            </span>
          )}
        </td>
        <td className="px-6 py-3.5 text-right">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleClose(); }}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
              isClosed
                ? "text-muted border-line/40 hover:bg-accent/40"
                : "text-white bg-brand border-transparent hover:bg-brand-dark"
            }`}
          >
            {isClosed ? <><RotateCcw className="w-3.5 h-3.5" /> Reopen</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Close case</>}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-accent/20">
          <td colSpan={6} className="px-6 py-5">
            <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
              <Field label="Product" value={c.product} />
              <Field label="Sub-product" value={c.sub_product} />
              <Field label="Company response" value={c.company_response} />
              <Field label="Cluster" value={c.cluster_name} />
            </div>
            <div className="text-xs uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1">
              <ChevronDown className="w-3 h-3" /> Consumer narrative
            </div>
            <p className="text-sm text-muted leading-relaxed glass-subtle rounded-xl p-4">
              "{c.narrative}{c.narrative?.length >= 1200 ? "…" : ""}"
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <span className="text-muted/70 uppercase tracking-wider">{label}: </span>
      <span className="text-ink font-medium">{value || "—"}</span>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="glass px-6 py-4 flex-1">
      <div className="text-sm text-muted font-medium">{label}</div>
      <div className="text-2xl font-bold font-heading mt-1" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 bg-accent/60 hover:bg-accent border border-line/30 rounded-xl text-sm font-semibold text-muted hover:text-ink cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand/30 transition-all max-w-[220px]"
    >
      {children}
    </select>
  );
}
