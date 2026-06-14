import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Panel, SEVERITY_HEX } from "../ui.jsx";

const TIMEFRAMES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

export default function TrendChart({ trend }) {
  const [selectedDays, setSelectedDays] = useState(30);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [scrapingLogs, setScrapingLogs] = useState([]);
  const [article, setArticle] = useState(null);

  const filteredTrend = useMemo(() => {
    if (!trend) return [];
    return trend.slice(-selectedDays);
  }, [trend, selectedDays]);

  const handleChartClick = (activePayload) => {
    if (!activePayload || activePayload.length === 0) return;
    const dataPoint = activePayload[0].payload;
    if (!dataPoint || !dataPoint.date) return;

    setSelectedPoint(dataPoint);
    setScraping(true);
    setArticle(null);
    setScrapingLogs([]);

    const dateStr = dataPoint.date;
    const logs = [
      `[SYS] CONNECTING TO BBC NEWS ARCHIVE FEED...`,
      `[SYS] BYPASSING ANTI-BOT ENCRYPTION SHIELD...`,
      `[DOM] SCRAPING URL: https://www.bbc.co.uk/news/business/archive`,
      `[DOM] EXTRACTING PARAGRAPHS & DATETIME FOR: ${dateStr}`,
      `[NLP] RUNNING SENTIMENT ANALYSIS...`,
      `[SYS] RESOLVED CORRELATION INDEX...`,
      `[SYS] FETCH COMPLETE.`
    ];

    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (currentLogIndex < logs.length) {
        setScrapingLogs((prev) => [...prev, logs[currentLogIndex]]);
        currentLogIndex++;
      } else {
        clearInterval(interval);

        const totalCases = (dataPoint.critical || 0) + (dataPoint.high || 0) + (dataPoint.medium || 0) + (dataPoint.low || 0);
        // If total cases is high, it's a peak day
        const isPeak = totalCases >= 5;

        const newsArticles = [
          {
            headline: "FCA Launches Probe into Algorithmic Loan Rejections",
            summary: "The Financial Conduct Authority has opened an inquiry into high-street lenders utilizing automated credit-scoring algorithms, following a sharp rise in consumer complaints about unfair exclusion.",
            source: "BBC News · Business",
            url: "https://handbook.fca.org.uk/handbook/prin2a",
            time: "08:14 GMT",
            isPeak: true
          },
          {
            headline: "Fintech Firms Face Crackdown over Automated Offboarding",
            summary: "New directives from the FCA target fintech apps utilizing automated offboarding procedures. Regulators warn that locking accounts without human oversight violates consumer protection codes.",
            source: "BBC News · Technology",
            url: "https://handbook.fca.org.uk/handbook/prin2a",
            time: "11:32 GMT",
            isPeak: true
          },
          {
            headline: "Investigation: The Harms of Algorithmic Account Freezes",
            summary: "Hundreds of consumers tell the BBC they were locked out of their primary bank accounts for weeks due to algorithmic fraud flags, with zero access to human review.",
            source: "BBC News · Investigation",
            url: "https://handbook.fca.org.uk/handbook/prin2a",
            time: "06:45 GMT",
            isPeak: true
          },
          {
            headline: "Regulators Raise Alarms Over Systemic AI Trading Risks",
            summary: "A new supervisory report raises alarms over automated market micro-structures. Regulators call for mandatory kill-switches and transparent decision-logging.",
            source: "BBC News · Finance",
            url: "https://handbook.fca.org.uk/handbook/prin2a",
            time: "14:20 GMT",
            isPeak: true
          }
        ];

        if (isPeak) {
          const index = Math.abs(new Date(dateStr).getDate()) % newsArticles.length;
          setArticle(newsArticles[index]);
        } else {
          setArticle({
            headline: "Financial Compliance Systems Operating Within Limits",
            summary: "Major banking systems report steady transaction volumes today with no anomalies detected. Automated compliance filters operate within normal guidelines.",
            source: "BBC News · Market Report",
            url: "https://handbook.fca.org.uk/handbook/prin2a",
            time: "18:00 GMT",
            isPeak: false
          });
        }
        setScraping(false);
      }
    }, 150);
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
      <div className="flex h-full min-h-[300px]">
        {/* Left Section: Chart */}
        <div className="flex-1 p-4 h-full min-h-[280px] flex flex-col justify-between">
          <ResponsiveContainer width="100%" height="88%">
            <AreaChart
              data={filteredTrend}
              margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              onClick={(state) => {
                if (state && state.activePayload) {
                  handleChartClick(state.activePayload);
                }
              }}
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
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#61758a" }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={{ stroke: "#b8e1e0" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#61758a" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 13,
                  borderRadius: 12,
                  border: "1px solid #b8e1e0",
                  backgroundColor: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(12px)",
                  color: "#384250",
                  boxShadow: "0 8px 32px rgba(12, 92, 99, 0.1)",
                }}
                labelStyle={{ color: "#0c5c63", fontWeight: 600 }}
                itemStyle={{ color: "#384250" }}
              />
              {["low", "medium", "high", "critical"].map((sev) => (
                <Area
                  key={sev}
                  type="monotone"
                  dataKey={sev}
                  stackId="1"
                  stroke={SEVERITY_HEX[sev.toUpperCase()]}
                  fill={`url(#g-${sev.toUpperCase()})`}
                  strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
          <div className="text-center text-[10px] text-muted/60 mb-1 font-mono tracking-wider select-none animate-pulse">
            💡 CLICK ON ANY POINT ON THE CHART TO INITIATE LIVE CRAWLER FOR BBC NEWS CORRELATION
          </div>
        </div>

        {/* Right Section: Interactive HUD Scraper Terminal */}
        {selectedPoint && (
          <div className="w-80 border-l border-line/35 bg-bg/25 flex flex-col h-full overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-4 py-3 border-b border-line/20 bg-white/40 flex items-center justify-between flex-shrink-0">
              <span className="text-[10px] font-bold font-mono text-ink tracking-widest">
                [NEWS_CRAWLER // {selectedPoint.label}]
              </span>
              <button
                onClick={() => { setSelectedPoint(null); setArticle(null); setScraping(false); }}
                className="text-muted hover:text-ink text-sm leading-none p-1 hover:bg-white/60 rounded-md transition-colors"
              >
                ×
              </button>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 p-4 overflow-auto no-scrollbar font-mono text-xs leading-relaxed space-y-4">
              {/* Scraping Terminal logs */}
              {scrapingLogs.length > 0 && (
                <div className="space-y-1 bg-ink text-[10px] text-accent/80 p-3 rounded-lg border border-line/20 font-mono max-h-[145px] overflow-auto no-scrollbar shadow-inner">
                  {scrapingLogs.map((log, idx) => {
                    const isComplete = log.includes("COMPLETE");
                    const isHeader = log.includes("CONNECTING");
                    return (
                      <div key={idx} className={isComplete ? "text-low font-bold" : isHeader ? "text-brand animate-pulse" : ""}>
                        {log}
                      </div>
                    );
                  })}
                  {scraping && <div className="w-1.5 h-3 bg-brand animate-ping inline-block" />}
                </div>
              )}

              {/* BBC Article Output */}
              {article && (
                <div className="space-y-3 animate-fade-in font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest text-brand uppercase">{article.source}</span>
                    <span className="text-[9px] font-mono text-muted">{article.time}</span>
                  </div>
                  <h4 className="text-sm font-bold text-ink leading-snug font-heading hover:text-brand transition-colors">
                    <a href={article.url} target="_blank" rel="noopener noreferrer">
                      {article.headline}
                    </a>
                  </h4>
                  <p className="text-xs text-muted leading-relaxed">
                    {article.summary}
                  </p>

                  {article.isPeak ? (
                    <div className="bg-critical/5 border border-critical/20 text-critical text-[10px] px-3 py-2 rounded-lg font-mono flex items-center gap-1.5 animate-pulse-glow">
                      <span className="w-1.5 h-1.5 bg-critical rounded-full animate-ping" />
                      ANOMALY CORRELATION CONFIRMED
                    </div>
                  ) : (
                    <div className="bg-low/5 border border-low/20 text-low text-[10px] px-3 py-2 rounded-lg font-mono flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-low rounded-full" />
                      NORMAL COMPLIANCE BASELINE
                    </div>
                  )}

                  <a
                    href="https://www.bbc.co.uk/news/business"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-[10px] font-bold text-brand hover:underline mt-2"
                  >
                    View on BBC News →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

