// Renders a tutor picture (see lib/graphic.ts): a shaded curve with the site's Curve component, or a
// small number line or bar chart in plain SVG. Ink on white; the one hue marks the shaded area or interval.
import Curve, { type CurveDist, type Region } from "./Curve.tsx";
import type { GraphicSpec } from "../lib/graphic.ts";

const num = (x: number) => (Math.abs(x) >= 1000 ? x.toFixed(0) : Number(x.toPrecision(4)).toString());

export default function TutorGraphic({ spec }: { spec: GraphicSpec }) {
  return (
    <figure className="tutor-graphic">
      <figcaption className="tutor-graphic-title">{spec.title}</figcaption>
      {spec.type === "curve" ? <CurvePic spec={spec} /> : spec.type === "interval" ? <IntervalPic spec={spec} /> : <BarsPic spec={spec} />}
      {spec.caption && <p className="hint tutor-graphic-caption">{spec.caption}</p>}
    </figure>
  );
}

function CurvePic({ spec }: { spec: Extract<GraphicSpec, { type: "curve" }> }) {
  const dist: CurveDist = spec.dist === "t" ? { kind: "t", df: spec.df! } : spec.dist === "normal" ? { kind: "normal", mean: spec.mean!, sd: spec.sd! } : { kind: "z" };
  const regions: Region[] = spec.shade.map((s) => ({ from: s.from ?? -Infinity, to: s.to ?? Infinity, kind: "p" }));
  const markers = spec.markers.map((m, i) => ({ x: m.x, label: m.label || num(m.x), tone: i === 0 ? ("accent" as const) : ("ink" as const), dashed: i > 0 }));
  return <Curve dist={dist} regions={regions} markers={markers} height={200} ariaLabel={`${spec.title}. ${spec.shade.map((s) => s.label).filter(Boolean).join(", ")}`} />;
}

function IntervalPic({ spec }: { spec: Extract<GraphicSpec, { type: "interval" }> }) {
  const W = 380, H = 104, pad = 30;
  const xs = [spec.lower, spec.upper, ...spec.points.map((p) => p.x)];
  const lo = Math.min(...xs), hi = Math.max(...xs), span = hi - lo || 1;
  const a = lo - span * 0.25, b = hi + span * 0.25;
  const X = (v: number) => pad + ((v - a) / (b - a)) * (W - 2 * pad);
  const y = 52;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tutor-svg" role="img" aria-label={`${spec.title}: from ${num(spec.lower)} to ${num(spec.upper)}`}>
      <line x1={pad - 12} x2={W - pad + 12} y1={y} y2={y} stroke="var(--control)" strokeWidth="1.5" />
      <rect x={X(spec.lower)} y={y - 7} width={X(spec.upper) - X(spec.lower)} height={14} rx={7} fill="var(--chart-3)" opacity="0.18" />
      <line x1={X(spec.lower)} x2={X(spec.upper)} y1={y} y2={y} stroke="var(--chart-3)" strokeWidth="3" />
      {[spec.lower, spec.upper].map((v, i) => (
        <g key={i}>
          <line x1={X(v)} x2={X(v)} y1={y - 12} y2={y + 12} stroke="var(--chart-3)" strokeWidth="2" />
          <text x={X(v)} y={y + 28} textAnchor="middle" className="tutor-svg-num">{num(v)}</text>
        </g>
      ))}
      {spec.points.map((p, i) => (
        <g key={`p${i}`}>
          <circle cx={X(p.x)} cy={y} r={5} fill="var(--text)" />
          <text x={X(p.x)} y={y - 16 - (i % 2) * 18} textAnchor="middle" className="tutor-svg-label">{p.label ? `${p.label} = ${num(p.x)}` : num(p.x)}</text>
        </g>
      ))}
    </svg>
  );
}

function BarsPic({ spec }: { spec: Extract<GraphicSpec, { type: "bars" }> }) {
  const W = 380, rowH = 34, pad = 6, labelW = 110, valW = 60;
  const H = spec.bars.length * rowH + pad * 2;
  const max = Math.max(...spec.bars.map((b) => Math.abs(b.value)), 1e-9);
  const barW = (v: number) => (Math.abs(v) / max) * (W - labelW - valW - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tutor-svg" role="img" aria-label={`${spec.title}: ${spec.bars.map((b) => `${b.label} ${num(b.value)}`).join(", ")}`}>
      {spec.bars.map((b, i) => {
        const y = pad + i * rowH;
        return (
          <g key={i}>
            <text x={labelW - 8} y={y + rowH / 2 + 4} textAnchor="end" className="tutor-svg-label">{b.label}</text>
            <rect x={labelW} y={y + 6} width={barW(b.value)} height={rowH - 12} rx={3} fill={i === 0 ? "var(--chart-3)" : "var(--text)"} className="tutor-bar" />
            <text x={labelW + barW(b.value) + 6} y={y + rowH / 2 + 4} className="tutor-svg-num">{num(b.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}
