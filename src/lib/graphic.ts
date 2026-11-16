// Simple pictures the tutor can draw: a shaded bell curve, an interval on a number line, or a few
// bars. Claude sends a small JSON spec through the `draw` tool; the site checks it here and renders it
// with its own components (no free-form SVG or HTML from the model ever reaches the page).

export type CurveSpec = {
  type: "curve";
  title: string;
  dist: "z" | "t" | "normal";
  df?: number;
  mean?: number;
  sd?: number;
  /** Shaded areas; null means "to the end of the curve". */
  shade: { from: number | null; to: number | null; label?: string }[];
  markers: { x: number; label: string }[];
  caption?: string;
};
export type IntervalSpec = {
  type: "interval";
  title: string;
  lower: number;
  upper: number;
  /** Points to mark on the line, e.g. x̄ or μ₀. */
  points: { x: number; label: string }[];
  caption?: string;
};
export type BarsSpec = {
  type: "bars";
  title: string;
  bars: { label: string; value: number }[];
  caption?: string;
};
export type GraphicSpec = CurveSpec | IntervalSpec | BarsSpec;

export const DRAW_TOOL_DESCRIPTION =
  "Draws one simple picture for the student, shown right where you call it. Use it whenever a picture makes the idea easier: " +
  "'curve' for a bell curve (z, t or a normal with its mean and sd) with shaded areas (p-values, α, probabilities) and labelled marks (the statistic, critical values, x̄); " +
  "'interval' for a confidence interval or 'where x̄ will land' on a number line with points marked; " +
  "'bars' for comparing a few numbers (two sample means, before vs after). Keep labels short (a few words). " +
  "Every number must already come from the excel tool. Returns 'shown'.";

export const DRAW_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["curve", "interval", "bars"] },
    title: { type: "string", description: "A short title, e.g. \"p-value = area left of T\"" },
    dist: { type: "string", enum: ["z", "t", "normal"], description: "curve: which curve" },
    df: { type: "number", description: "curve, t only: degrees of freedom" },
    mean: { type: "number", description: "curve, normal only" },
    sd: { type: "number", description: "curve, normal only" },
    shade: {
      type: "array",
      description: "curve: shaded areas; from/to null = to the end of the curve",
      items: { type: "object", properties: { from: { type: ["number", "null"] }, to: { type: ["number", "null"] }, label: { type: "string" } }, required: ["from", "to"] },
    },
    markers: { type: "array", description: "curve: vertical marks", items: { type: "object", properties: { x: { type: "number" }, label: { type: "string" } }, required: ["x", "label"] } },
    lower: { type: "number", description: "interval: lower limit" },
    upper: { type: "number", description: "interval: upper limit" },
    points: { type: "array", description: "interval: points to mark", items: { type: "object", properties: { x: { type: "number" }, label: { type: "string" } }, required: ["x", "label"] } },
    bars: { type: "array", description: "bars: 2–6 bars", items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" } }, required: ["label", "value"] } },
    caption: { type: "string", description: "One short plain sentence under the picture" },
  },
  required: ["type", "title"],
};

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const txt = (v: unknown, n = 60) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n) : "");
const arr = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];

/** Checks and trims a spec from Claude. Returns null (with a reason) if it can't be drawn. */
export function cleanGraphic(input: unknown): { spec: GraphicSpec } | { error: string } {
  const o = (input ?? {}) as Record<string, unknown>;
  const title = txt(o.title, 80) || "Picture";
  const caption = txt(o.caption, 200) || undefined;
  if (o.type === "curve") {
    const dist = o.dist === "t" || o.dist === "normal" ? o.dist : "z";
    if (dist === "t" && !(fin(o.df) && o.df >= 1 && o.df <= 10_000)) return { error: "t curve needs df ≥ 1" };
    if (dist === "normal" && !(fin(o.mean) && fin(o.sd) && o.sd > 0)) return { error: "normal curve needs mean and sd > 0" };
    const end = (v: unknown) => (v === null || v === undefined ? null : fin(v) ? v : NaN);
    const shade = arr(o.shade).slice(0, 4).map((s) => ({ from: end(s.from), to: end(s.to), label: txt(s.label, 30) || undefined }))
      .filter((s) => !Number.isNaN(s.from) && !Number.isNaN(s.to)) as CurveSpec["shade"];
    const markers = arr(o.markers).slice(0, 5).filter((m) => fin(m.x)).map((m) => ({ x: m.x as number, label: txt(m.label, 24) }));
    return { spec: { type: "curve", title, dist, ...(dist === "t" ? { df: o.df as number } : {}), ...(dist === "normal" ? { mean: o.mean as number, sd: o.sd as number } : {}), shade, markers, caption } };
  }
  if (o.type === "interval") {
    if (!fin(o.lower) || !fin(o.upper) || o.upper <= o.lower) return { error: "interval needs lower < upper" };
    const points = arr(o.points).slice(0, 4).filter((p) => fin(p.x)).map((p) => ({ x: p.x as number, label: txt(p.label, 24) }));
    return { spec: { type: "interval", title, lower: o.lower, upper: o.upper, points, caption } };
  }
  if (o.type === "bars") {
    const bars = arr(o.bars).slice(0, 6).filter((b) => fin(b.value)).map((b) => ({ label: txt(b.label, 24), value: b.value as number }));
    if (bars.length < 1) return { error: "bars needs at least one bar" };
    return { spec: { type: "bars", title, bars, caption } };
  }
  return { error: "type must be curve, interval or bars" };
}
