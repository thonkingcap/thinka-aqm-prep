import { useId, useLayoutEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { normPdf, tPdf } from "../lib/stats.ts";
import "./components.css";

export type Region = { from: number; to: number; kind: "p" | "alpha" | "fill" };
export type Marker = { x: number; label: string; tone?: "ink" | "accent" | "muted"; dashed?: boolean };
export type CurveDist = { kind: "z" } | { kind: "t"; df: number } | { kind: "normal"; mean: number; sd: number };
export type CurveProps = {
  dist: CurveDist;
  regions?: Region[];
  markers?: Marker[];
  domain?: [number, number];
  ticks?: number[];
  tickFormat?: (x: number) => string;
  height?: number;
  ariaLabel: string;
  compact?: boolean;
};

const SAMPLES = 321; // >= 241
const LABEL_GAP = 40; // px: labels closer than this horizontally get stacked
const LINE_H = 14; // px between stacked labels
const TONE: Record<NonNullable<Marker["tone"]>, string> = {
  ink: "var(--text)",
  accent: "var(--chart-3)",
  muted: "var(--muted)",
};

function densityFn(dist: CurveDist): (x: number) => number {
  if (dist.kind === "t") return (x) => tPdf(x, dist.df);
  if (dist.kind === "normal") return (x) => normPdf(x, dist.mean, dist.sd);
  return (x) => normPdf(x, 0, 1);
}

function defaultDomain(dist: CurveDist, markers: Marker[]): [number, number] {
  const xs = markers.map((m) => m.x).filter(Number.isFinite);
  if (dist.kind === "normal") {
    const pad = 0.5 * dist.sd;
    let lo = dist.mean - 4 * dist.sd;
    let hi = dist.mean + 4 * dist.sd;
    for (const x of xs) {
      lo = Math.min(lo, x - pad);
      hi = Math.max(hi, x + pad);
    }
    return [lo, hi];
  }
  let lo = -4;
  let hi = 4;
  for (const x of xs) {
    lo = Math.min(lo, x - 0.5);
    hi = Math.max(hi, x + 0.5);
  }
  return [lo, hi];
}

function defaultTicks(dist: CurveDist, [lo, hi]: [number, number]): number[] {
  const out: number[] = [];
  const center = dist.kind === "normal" ? dist.mean : 0;
  const step = dist.kind === "normal" ? dist.sd : 1;
  for (let k = -3; k <= 3; k++) {
    const v = center + k * step;
    if (v >= lo && v <= hi) out.push(v);
  }
  return out;
}

function defaultFormat(x: number): string {
  const r = Math.round(x * 1000) / 1000;
  const s = String(Object.is(r, -0) ? 0 : r);
  return s.startsWith("-") ? "−" + s.slice(1) : s;
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

export default function Curve(props: CurveProps): JSX.Element {
  const { dist, regions = [], markers = [], height = 220, ariaLabel, compact = false, tickFormat = defaultFormat } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setWidth((prev) => (prev === w ? prev : w));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rawId = useId();
  const uid = "curve" + rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const hatchId = `${uid}-hatch`;

  const domain = props.domain ?? defaultDomain(dist, markers);
  const ticks = props.ticks ?? defaultTicks(dist, domain);
  const pdf = densityFn(dist);

  const [lo, hi] = domain;
  const fontSize = compact ? 11 : 12;
  const m = compact ? { top: 18, right: 10, bottom: 20, left: 10 } : { top: 24, right: 14, bottom: 24, left: 14 };
  const plotW = Math.max(40, width - m.left - m.right);
  const baseY = height - m.bottom;
  const plotH = Math.max(20, baseY - m.top);

  // Curve samples
  const samples: [number, number][] = [];
  let maxD = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const x = lo + ((hi - lo) * i) / (SAMPLES - 1);
    const d = pdf(x);
    samples.push([x, d]);
    if (d > maxD) maxD = d;
  }
  maxD = maxD > 0 ? maxD : 1;
  const sx = (x: number) => m.left + ((x - lo) / (hi - lo)) * plotW;
  const sy = (d: number) => baseY - (d / maxD) * plotH * 0.92;

  const curvePath = samples.map(([x, d], i) => `${i ? "L" : "M"}${f(sx(x))},${f(sy(d))}`).join("");

  // Region shapes, sampled from the same density so the top edge sits on the curve
  const regionShapes = regions
    .map((r, i) => {
      const a = Math.max(lo, Math.min(r.from, r.to));
      const b = Math.min(hi, Math.max(r.from, r.to));
      if (!(b > a)) return null;
      const n = Math.max(2, Math.ceil(((b - a) / (hi - lo)) * (SAMPLES - 1)) + 1);
      const pts: string[] = [];
      for (let k = 0; k < n; k++) {
        const x = a + ((b - a) * k) / (n - 1);
        pts.push(`${f(sx(x))},${f(sy(pdf(x)))}`);
      }
      const top = "M" + pts.join("L");
      const area = `M${f(sx(a))},${baseY}L${pts.join("L")}L${f(sx(b))},${baseY}Z`;
      return { key: i, kind: r.kind, area, top };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Markers + collision-avoiding labels
  const charW = fontSize * 0.58;
  type Placed = { x: number; y: number; w: number };
  const placed: Placed[] = [];
  const markerShapes = markers
    .filter((mk) => Number.isFinite(mk.x) && mk.x >= lo && mk.x <= hi)
    .map((mk, i) => ({ mk, i, px: sx(mk.x) }))
    .sort((p, q) => p.px - q.px)
    .map(({ mk, i, px }) => {
      const topY = mk.dashed ? m.top - 2 : sy(pdf(mk.x));
      const w = Math.max(8, mk.label.length * charW);
      const cx = Math.min(Math.max(px, w / 2 + 2), width - w / 2 - 2);
      let y = topY - 6;
      for (let guard = 0; guard < 12; guard++) {
        const clash = placed.some((p) => Math.abs(p.x - cx) < Math.max(LABEL_GAP, (p.w + w) / 2 + 4) && Math.abs(p.y - y) < LINE_H);
        if (!clash) break;
        y -= LINE_H;
      }
      y = Math.max(fontSize, y);
      placed.push({ x: cx, y, w });
      return { key: i, mk, px, topY, cx, y };
    });

  return (
    <div ref={wrapRef} className={compact ? "curve curve-compact" : "curve"}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="curve-svg"
      >
        <defs>
          <pattern id={hatchId} patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--chart-1)" strokeWidth="1" />
          </pattern>
        </defs>

        {regionShapes.map((r) =>
          r.kind === "p" ? (
            <g key={r.key} className="curve-region curve-region-p">
              <path d={r.area} fill="var(--chart-3)" fillOpacity={0.22} stroke="none" />
              <path d={r.top} fill="none" stroke="var(--chart-3)" strokeWidth={1.5} strokeLinejoin="round" />
            </g>
          ) : r.kind === "alpha" ? (
            <path key={r.key} className="curve-region curve-region-alpha" d={r.area} fill={`url(#${hatchId})`} stroke="none" />
          ) : (
            <path key={r.key} className="curve-region curve-region-fill" d={r.area} fill="var(--chart-1)" fillOpacity={0.1} stroke="none" />
          ),
        )}

        <line x1={m.left} x2={m.left + plotW} y1={baseY + 0.5} y2={baseY + 0.5} stroke="var(--control)" strokeWidth={1} />

        <path d={curvePath} fill="none" stroke="var(--chart-1)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />

        {ticks
          .filter((t) => Number.isFinite(t) && t >= lo && t <= hi)
          .map((t, i) => {
            const x = sx(t);
            return (
              <g key={i} className="curve-tick">
                <line x1={x} x2={x} y1={baseY} y2={baseY + 4} stroke="var(--control)" strokeWidth={1} />
                <text x={x} y={baseY + 6 + fontSize} textAnchor="middle" fontSize={fontSize} fill="var(--muted)" className="curve-tick-label">
                  {tickFormat(t)}
                </text>
              </g>
            );
          })}

        {markerShapes.map(({ key, mk, px, topY }) => (
          <line
            key={key}
            className="curve-marker"
            x1={px}
            x2={px}
            y1={baseY}
            y2={topY}
            stroke={TONE[mk.tone ?? "ink"]}
            strokeWidth={1}
            strokeDasharray={mk.dashed ? "4 3" : undefined}
          />
        ))}

        {/* labels after all lines, so no marker line crosses a label */}
        {markerShapes.map(({ key, mk, cx, y }) => (
          <text key={key} x={cx} y={y} textAnchor="middle" fontSize={fontSize} fill={TONE[mk.tone ?? "ink"]} className="curve-marker-label">
            {mk.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
