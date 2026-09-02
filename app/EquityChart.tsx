"use client";

import { useMemo, useRef, useState } from "react";

export type EquityPoint = { ts: string; equity: number; pnl_day: number };

const W = 900;
const H = 220;
const PAD = { l: 64, r: 16, t: 14, b: 26 };

export default function EquityChart({ points }: { points: EquityPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const model = useMemo(() => {
    if (points.length < 2) return null;
    const xs = points.map((p) => new Date(p.ts).getTime());
    const ys = points.map((p) => p.equity);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (y1 - y0 < 1) { y0 -= 1; y1 += 1; } // flat line: give it breathing room
    const padY = (y1 - y0) * 0.12;
    y0 -= padY; y1 += padY;
    const sx = (t: number) => PAD.l + ((t - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
    const sy = (v: number) => PAD.t + (1 - (v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
    const path = points.map((p, i) => `${i ? "L" : "M"}${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join("");
    const area = `${path}L${sx(x1).toFixed(1)},${H - PAD.b}L${sx(x0).toFixed(1)},${H - PAD.b}Z`;
    return { xs, ys, x0, x1, y0, y1, sx, sy, path, area };
  }, [points]);

  if (!model) {
    return (
      <div className="chart-empty">
        📈 Equity history will appear here once Supabase is connected and the
        guardian has collected a few ticks.
      </div>
    );
  }

  const { xs, ys, y0, y1, sx, sy, path, area } = model;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const d = Math.abs(sx(xs[i]) - px);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHover(best);
  }

  const fmt = (v: number) => "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const gridVals = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15];
  const hi = hover !== null ? hover : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      role="img"
      aria-label="Account equity over time"
    >
      <defs>
        <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#632ca6" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#632ca6" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="#eceaf2" strokeWidth="1" />
          <text x={PAD.l - 8} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="#6f6b85">
            {fmt(v)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#eqfill)" />
      <path d={path} fill="none" stroke="#632ca6" strokeWidth="2" strokeLinejoin="round" />

      {/* time labels: first and last */}
      <text x={PAD.l} y={H - 8} fontSize="11" fill="#6f6b85">
        {new Date(xs[0]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </text>
      <text x={W - PAD.r} y={H - 8} fontSize="11" fill="#6f6b85" textAnchor="end">
        {new Date(xs[xs.length - 1]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </text>

      {hi !== null && (
        <g>
          <line x1={sx(xs[hi])} x2={sx(xs[hi])} y1={PAD.t} y2={H - PAD.b} stroke="#6f6b85" strokeWidth="1" strokeDasharray="3,3" />
          <circle cx={sx(xs[hi])} cy={sy(ys[hi])} r="4" fill="#632ca6" stroke="#ffffff" strokeWidth="2" />
          {(() => {
            const boxW = 128, boxH = 40;
            const bx = Math.min(Math.max(sx(xs[hi]) - boxW / 2, PAD.l), W - PAD.r - boxW);
            const by = sy(ys[hi]) - boxH - 12 < PAD.t ? sy(ys[hi]) + 12 : sy(ys[hi]) - boxH - 12;
            return (
              <g>
                <rect x={bx} y={by} width={boxW} height={boxH} rx="6" fill="#ffffff" stroke="#eceaf2" />
                <text x={bx + boxW / 2} y={by + 17} textAnchor="middle" fontSize="12" fontWeight="700" fill="#21173a">
                  {"$" + ys[hi].toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </text>
                <text x={bx + boxW / 2} y={by + 32} textAnchor="middle" fontSize="10" fill="#6f6b85">
                  {new Date(xs[hi]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </text>
              </g>
            );
          })()}
        </g>
      )}
    </svg>
  );
}
