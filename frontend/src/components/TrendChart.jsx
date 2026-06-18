import { useMemo, useRef, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ExternalLink, Newspaper, Building2, Tag, Wrench } from "lucide-react";
import { Panel, SEVERITY_HEX } from "../ui.jsx";
import { fetchDrilldown } from "../api.js";

const TIMEFRAMES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "6M", days: 185 },
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export default function TrendChart({ trend }) {
  const [selectedDays, setSelectedDays] = useState(185);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const activeDateRef = useRef(null);

  const filteredTrend = useMemo(() => {
    if (!trend) return [];
    return trend.slice(-selectedDays);
  }, [trend, selectedDays]);

  const handleChartClick = (activePayload) => {
    if (!activePayload || activePayload.length === 0) return;
    const dataPoint = activePayload[0].payload;
    if (!dataPoint || !dataPoint.date) return;

    const date = dataPoint.date;
    // The synthetic click can fire several times — ignore re-entry for the same
    // point while a request is in flight, and cancel any prior step ticker.
    if (activeDateRef.current === date) return;
    activeDateRef.current = date;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedPoint(dataPoint);
    setLoading(true);
    setResult(null);
    setError(null);

    const steps = [
      `[SYS] QUERYING CFPB RECORDS FOR ${date} ...`,
      `[AGG] AGGREGATING CASES BY FIRM / ISSUE / CLUSTER ...`,
      `[WEB] GROUNDED NEWS SEARCH VIA ANALYSIS ENGINE ...`,
      `[NLP] SYNTHESISING DRIVERS & RESPONSE ...`,
    ];
    setLogs([steps[0]]);
    let i = 1;
    timerRef.current = setInterval(() => {
      if (i < steps.length) { const s = steps[i]; i += 1; setLogs((p) => [...p, s]); }
      else { clearInterval(timerRef.current); timerRef.current = null; }
    }, 260);

    // Always let the analysis "run" for at least ~1.2s so it reads as a real search.
    Promise.all([fetchDrilldown(date), delay(1200)])
      .then(([r]) => {
        setResult(r);
        setLogs((p) => [...p, `[SYS] ANALYSIS COMPLETE — ${r.total} CASE(S).`]);
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        activeDateRef.current = null;
        setLoading(false);
      });
  };

  const closePanel = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    activeDateRef.current = null;
    setSelectedPoint(null); setResult(null); setError(null); setLoading(false);
  };

  return (
    <Panel
      title="Alert Volume Trend"
      subtitle={`trailing ${selectedDays} days · by severity`}
      className="h-full"
      right={
        <div className="flex gap-1 bg-accent/50 p-1 rounded-xl border border-line/30">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              onClick={() => setSelectedDays(tf.days)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 ${selectedDays === tf.days
                ? "bg-brand text-white shadow-sm"
                : "text-muted hover:text-ink hover:bg-white/60 border border-transparent"
                }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      }
    >
      {/* Chart on top; the day-analysis renders BELOW it, full width. */}
      <div className="flex flex-col">
        <div className="p-4 min-h-[280px]">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={filteredTrend}
              margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              onClick={(state) => { if (state && state.activePayload) handleChartClick(state.activePayload); }}
              className="cursor-pointer"
            >
              <defs>
                {Object.entries(SEVERITY_HEX).map(([k, hex]) => (
                  <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={hex} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={hex} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#b8e1e040" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#61758a" }} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: "#b8e1e0" }} />
              <YAxis tick={{ fontSize: 11, fill: "#61758a" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 13, borderRadius: 12, border: "1px solid #b8e1e0", backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", color: "#384250", boxShadow: "0 8px 32px rgba(12, 92, 99, 0.1)" }}
                labelStyle={{ color: "#0c5c63", fontWeight: 600 }}
                itemStyle={{ color: "#384250" }}
              />
              {["low", "medium", "high", "critical"].map((sev) => (
                <Area key={sev} type="monotone" dataKey={sev} stackId="1" stroke={SEVERITY_HEX[sev.toUpperCase()]} fill={`url(#g-${sev.toUpperCase()})`} strokeWidth={1.5} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
          {!selectedPoint && (
            <div className="text-center text-[10px] text-muted/60 mt-1 font-mono tracking-wider select-none animate-pulse px-2">
              💡 CLICK ANY POINT TO ANALYSE THAT DAY — REAL CASES + LIVE NEWS CORRELATION
            </div>
          )}
        </div>

        {/* Day-analysis panel (below the chart) */}
        {selectedPoint && (
          <div className="border-t border-line/35 bg-bg/25 animate-fade-in">
            <div className="px-4 sm:px-5 py-3 border-b border-line/20 bg-white/40 flex items-center justify-between">
              <span className="text-[11px] font-bold font-mono text-ink tracking-widest">
                [DAY_ANALYSIS // {selectedPoint.label}]
              </span>
              <button onClick={closePanel} className="text-muted hover:text-ink text-sm leading-none p-1 hover:bg-white/60 rounded-md transition-colors">× close</button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Terminal log */}
              {logs.length > 0 && (
                <div className="space-y-1 bg-ink text-[10px] text-accent/80 p-3 rounded-lg border border-line/20 font-mono overflow-auto no-scrollbar">
                  {logs.filter(Boolean).map((log, idx) => (
                    <div key={idx} className={String(log).includes("COMPLETE") ? "text-low font-bold" : String(log).includes("QUERYING") ? "text-brand" : ""}>{log}</div>
                  ))}
                  {loading && <span className="inline-block w-1.5 h-3 bg-brand animate-ping" />}
                </div>
              )}

              {error && <div className="bg-critical/5 border border-critical/20 text-critical text-xs px-3 py-2 rounded-lg">{error}</div>}

              {result && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
                  {/* Left: real case aggregation */}
                  <div className="space-y-3">
                    <Stat label="Flagged cases that day" value={result.total} />
                    {result.total > 0 && result.top_companies?.length > 0 && (
                      <Group Icon={Building2} title="Top firms">
                        {result.top_companies.map((c) => <Row key={c.name} name={c.name} count={c.count} />)}
                      </Group>
                    )}
                    {result.total > 0 && result.top_issues?.length > 0 && (
                      <Group Icon={Tag} title="Top issues">
                        {result.top_issues.map((c) => <Row key={c.name} name={c.name} count={c.count} />)}
                      </Group>
                    )}
                    {result.suggested_actions?.length > 0 && (
                      <Group Icon={Wrench} title="Suggested actions">
                        {result.suggested_actions.map((a, i) => (
                          <p key={i} className="text-xs text-ink leading-relaxed flex gap-1.5 py-0.5">
                            <span className="text-brand flex-shrink-0">→</span> {a}
                          </p>
                        ))}
                      </Group>
                    )}
                  </div>

                  {/* Right: synthesis + real news links */}
                  <div className="space-y-3">
                    {result.narrative && (
                      <div className="glass-subtle p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold tracking-widest text-brand uppercase flex items-center gap-1.5">
                            <Newspaper className="w-3.5 h-3.5" /> Analysis
                          </span>
                          <span className="text-[9px] font-mono text-muted">engine: {result.provider}</span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed font-sans whitespace-pre-line">{result.narrative}</p>
                      </div>
                    )}

                    {result.news?.length > 0 ? (
                      <Group Icon={ExternalLink} title={`Sources (${result.news.length})`}>
                        {result.news.map((n, i) => {
                          const showSource = n.source && n.source !== n.headline;
                          return (
                            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-start gap-1.5 text-xs text-brand hover:underline py-1 group">
                              <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-60 group-hover:opacity-100" />
                              <span className="min-w-0">
                                <span className="block leading-snug break-words">{n.headline}</span>
                                {showSource && <span className="text-muted/60 text-[10px]">{n.source}</span>}
                              </span>
                            </a>
                          );
                        })}
                      </Group>
                    ) : (
                      result.provider === "data-only" && (
                        <p className="text-[11px] text-muted/70 leading-relaxed bg-accent/30 border border-line/30 rounded-lg p-3">
                          No live news layer — set an analysis engine with a key (Scoring page) to enable real news correlation for this day.
                        </p>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Stat({ label, value }) {
  return (
    <div className="glass-subtle p-3 flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-lg font-bold text-ink font-heading">{value}</span>
    </div>
  );
}

function Group({ Icon, title, children }) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-widest text-muted uppercase mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />} {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ name, count }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-ink truncate">{name}</span>
      <span className="font-mono text-brand font-semibold flex-shrink-0">{count}</span>
    </div>
  );
}
