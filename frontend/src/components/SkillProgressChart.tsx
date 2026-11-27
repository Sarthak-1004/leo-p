import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StudentInsights } from "../types/domain";

// Band over time for each skill on one 0-9 axis. Colours are fixed per skill (validated categorical
// palette, light mode); the two lighter hues fall below 3:1, so lines carry direct labels and a table view exists.
const SERIES = [
  { key: "listening", label: "Listening", color: "#2a78d6" },
  { key: "reading", label: "Reading", color: "#eb6834" },
  { key: "writing", label: "Writing", color: "#1baf7a" },
  { key: "speaking", label: "Speaking", color: "#eda100" },
] as const;
type Point = StudentInsights["progress"][number];
const RANGES = [
  ["1 month", 31],
  ["3 months", 92],
  ["6 months", 183],
] as const;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function SkillProgressChart({ points }: { points: Point[] }) {
  const [range, setRange] = useState<number>(183),
    [table, setTable] = useState(false),
    [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);
  const [now] = useState(() => Date.now());
  const shown = useMemo(
    () => points.filter(p => new Date(p.date).getTime() >= now - range * 86400000),
    [points, range, now],
  );
  const H = 240,
    pad = { l: 34, r: width < 480 ? 16 : 78, t: 14, b: 28 },
    iw = width - pad.l - pad.r,
    ih = H - pad.t - pad.b;
  const t0 = now - range * 86400000,
    x = (iso: string) => pad.l + ((new Date(iso).getTime() - t0) / (now - t0)) * iw,
    y = (b: number) => pad.t + (1 - b / 9) * ih;
  const near = (px: number) =>
    shown.reduce((best, p, i) => (Math.abs(x(p.date) - px) < Math.abs(x(shown[best]!.date) - px) ? i : best), 0);
  const active = hover !== null ? shown[hover] : undefined;
  // Direct labels sit at each line's last point, pushed apart vertically so they never overlap.
  const labelY: Record<string, number> = {};
  const ends = SERIES.map(s => {
    const last = [...shown].reverse().find(p => p[s.key] !== null);
    return last ? { key: s.key, y: y(last[s.key]!) } : null;
  })
    .filter((e): e is { key: (typeof SERIES)[number]["key"]; y: number } => !!e)
    .sort((a, b) => a.y - b.y);
  ends.forEach((e, i) => {
    labelY[e.key] = i ? Math.max(e.y, labelY[ends[i - 1]!.key]! + 13) : e.y;
  });

  return (
    <div className="chart-card">
      <div className="chart-toolbar">
        <div className="chart-legend" aria-label="Legend">
          {SERIES.map(s => (
            <span key={s.key}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Time range">
          {RANGES.map(([label, days]) => (
            <button
              type="button"
              key={days}
              aria-pressed={range === days}
              onClick={() => {
                setRange(days);
                setHover(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!shown.length ? (
        <p className="muted text-sm chart-empty">
          No scored tests in this period yet. Your bands appear here after each Practice Mock and released Full Length
          Test.
        </p>
      ) : table ? (
        <div className="table-scroll">
          <table className="chart-table">
            <caption className="sr-only">Band by test</caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>Test</th>
                {SERIES.map(s => (
                  <th key={s.key}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((p, i) => (
                <tr key={i}>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.name}</td>
                  {SERIES.map(s => (
                    <td key={s.key}>{p[s.key]?.toFixed(1) ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-wrap" ref={wrap}>
          <svg
            width={width}
            height={H}
            role="img"
            aria-label="Band progress by skill over time"
            onPointerMove={e => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              setHover(near(e.clientX - r.left));
            }}
            onPointerLeave={() => setHover(null)}
          >
            {[0, 3, 6, 9].map(b => (
              <g key={b}>
                <line x1={pad.l} x2={width - pad.r} y1={y(b)} y2={y(b)} className="chart-grid" />
                <text x={pad.l - 8} y={y(b) + 4} className="chart-axis" textAnchor="end">
                  {b}
                </text>
              </g>
            ))}
            {[0, 0.5, 1].map(f => {
              const t = new Date(t0 + f * (now - t0)).toISOString();
              return (
                <text
                  key={f}
                  x={x(t)}
                  y={H - 8}
                  className="chart-axis"
                  textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
                >
                  {fmtDate(t)}
                </text>
              );
            })}
            {active && (
              <line x1={x(active.date)} x2={x(active.date)} y1={pad.t} y2={pad.t + ih} className="chart-crosshair" />
            )}
            {SERIES.map(s => {
              const pts = shown.filter(p => p[s.key] !== null).map(p => [x(p.date), y(p[s.key]!)] as const);
              if (!pts.length) return null;
              const last = [pts[pts.length - 1]![0], labelY[s.key] ?? pts[pts.length - 1]![1]] as const;
              return (
                <g key={s.key}>
                  {pts.length > 1 && (
                    <polyline
                      points={pts.map(p => p.join(",")).join(" ")}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {pts.map(([px, py], i) => (
                    <circle key={i} cx={px} cy={py} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
                  ))}
                  {width >= 480 && (
                    <text x={last[0] + 8} y={last[1] + 4} className="chart-label">
                      {s.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {active && (
            <div
              className="chart-tip"
              style={{ left: Math.min(x(active.date) + 12, width - 190), top: 8 }}
              role="status"
            >
              <strong>{active.name}</strong>
              <span className="muted">{fmtDate(active.date)}</span>
              {SERIES.map(s => (
                <span key={s.key} className="chart-tip-row">
                  <i style={{ background: s.color }} />
                  {s.label}
                  <b>{active[s.key]?.toFixed(1) ?? "—"}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {shown.length > 0 && (
        <button type="button" className="link-button" onClick={() => setTable(!table)}>
          {table ? "Show chart" : "Show as table"}
        </button>
      )}
    </div>
  );
}
