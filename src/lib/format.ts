/** Number formatting shared by the site and the grader (no React). */
export function fmtNumber(v: number, format?: "prob" | "num" | "pct"): string {
  if (!Number.isFinite(v)) return "—";
  if (format === "prob") return v < 0.0001 && v > 0 ? v.toExponential(2) : v.toFixed(4);
  if (format === "pct") return `${(v * 100).toFixed(2)}%`;
  const a = Math.abs(v);
  const d = a >= 1000 ? 1 : a >= 100 ? 2 : 4;
  return Number(v.toFixed(d)).toLocaleString("en-US", { maximumFractionDigits: d });
}
