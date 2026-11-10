// The 12 hypothesis test questions from the whiteboard:
// 3 null hypotheses × (σ known: Z | σ unknown: T, ν = n − 1) × (p-value | critical value).
// Formulas follow the professor's convention: one-tail .DIST/.INV functions only, and the
// two-tailed p-value formula is chosen by the sign of the statistic (no ABS, no T.DIST.2T).
import { normCdf, normInv, tCdf, tInv } from "./stats.ts";

export type Null = "le" | "eq" | "ge"; // H0: μ ≤ μ0 (right tail) · μ = μ0 (two tails) · μ ≥ μ0 (left tail)
export type Sigma = "known" | "unknown";
export type Method = "p" | "crit";

export const NULLS: { id: Null; h0: string; ha: string; tail: string; tailShort: string }[] = [
  { id: "le", h0: "H₀: μ ≤ μ₀", ha: "H_A: μ > μ₀", tail: "Right tail", tailShort: "right" },
  { id: "eq", h0: "H₀: μ = μ₀", ha: "H_A: μ ≠ μ₀", tail: "Two tails", tailShort: "two" },
  { id: "ge", h0: "H₀: μ ≥ μ₀", ha: "H_A: μ < μ₀", tail: "Left tail", tailShort: "left" },
];

export type TestInput = {
  h0: Null;
  sigma: Sigma;
  xbar: number;
  mu0: number;
  sd: number; // σ when known, s when unknown
  n: number;
  alpha: number;
};

export type TestResult = TestInput & {
  se: number;
  stat: number;
  df: number | null;
  statName: "Z" | "T";
  pValue: number;
  /** Critical value(s). Right: [c]; left: [c] (negative); two tails: [-c, c]. */
  crit: number[];
  reject: boolean;
  /** Excel formulas, written the way class writes them, with the numbers filled in. */
  excel: { se: string; stat: string; p: string; crit: string; rule: string };
  /** The same formulas with cell-style names, for the 12-case reference grid. */
  generic: { p: string; crit: string; rule: string };
};

const r = (x: number, d = 4) => {
  const v = Number(x.toFixed(d));
  return Object.is(v, -0) ? "0" : String(v);
};

/** Generic formulas for the reference grid (statistic named Z or T). */
export function genericFormulas(h0: Null, sigma: Sigma, statSign: 1 | -1 = 1) {
  const S = sigma === "known" ? "Z" : "T";
  const dist = (x: string) => (sigma === "known" ? `NORM.S.DIST(${x},TRUE)` : `T.DIST(${x},ν,TRUE)`);
  const inv = (p: string) => (sigma === "known" ? `NORM.S.INV(${p})` : `T.INV(${p},ν)`);
  if (h0 === "le") return { p: `=1-${dist(S)}`, crit: `=${inv("1-α")}`, rule: `Reject H₀ if ${S} > critical value` };
  if (h0 === "ge") return { p: `=${dist(S)}`, crit: `=${inv("α")}`, rule: `Reject H₀ if ${S} < critical value (it is negative)` };
  return {
    p: statSign < 0 ? `=2*${dist(S)}` : `=2*(1-${dist(S)})`,
    crit: `=±${inv("1-α/2")}`,
    rule: `Reject H₀ if ${S} < −crit or ${S} > +crit`,
  };
}

export function runTest(input: TestInput): TestResult {
  const { h0, sigma, xbar, mu0, sd, n, alpha } = input;
  if (!(n >= 2) || !(sd > 0) || !(alpha > 0 && alpha < 1)) throw new Error("Need n ≥ 2, a positive standard deviation and 0 < α < 1");
  const se = sd / Math.sqrt(n);
  const stat = (xbar - mu0) / se;
  const known = sigma === "known";
  const df = known ? null : n - 1;
  const cdf = (x: number) => (known ? normCdf(x) : tCdf(x, df!));
  const inv = (p: number) => (known ? normInv(p) : tInv(p, df!));
  const S = known ? "Z" : "T";
  const distF = (x: string) => (known ? `NORM.S.DIST(${x},TRUE)` : `T.DIST(${x},${df},TRUE)`);
  const invF = (p: string) => (known ? `NORM.S.INV(${p})` : `T.INV(${p},${df})`);

  const seF = `=${r(sd)}/SQRT(${n})`;
  const statF = `=(${r(xbar)}-${r(mu0)})/(${r(sd)}/SQRT(${n}))`;
  const statCell = r(stat);
  let pValue: number, crit: number[], reject: boolean, pF: string, critF: string, rule: string;

  if (h0 === "le") {
    pValue = 1 - cdf(stat);
    crit = [inv(1 - alpha)];
    reject = stat > crit[0];
    pF = `=1-${distF(statCell)}`;
    critF = `=${invF(`1-${alpha}`)}`;
    rule = `${S} > ${r(crit[0], 3)}`;
  } else if (h0 === "ge") {
    pValue = cdf(stat);
    crit = [inv(alpha)];
    reject = stat < crit[0];
    pF = `=${distF(statCell)}`;
    critF = `=${invF(String(alpha))}`;
    rule = `${S} < ${r(crit[0], 3)}`;
  } else {
    pValue = stat < 0 ? 2 * cdf(stat) : 2 * (1 - cdf(stat));
    const c = inv(1 - alpha / 2);
    crit = [-c, c];
    reject = stat < -c || stat > c;
    pF = stat < 0 ? `=2*${distF(statCell)}` : `=2*(1-${distF(statCell)})`;
    critF = `=${invF(`1-${alpha}/2`)}`;
    rule = `${S} < ${r(-c, 3)} or ${S} > ${r(c, 3)}`;
  }

  return {
    ...input,
    se,
    stat,
    df,
    statName: S,
    pValue,
    crit,
    reject,
    excel: { se: seF, stat: statF, p: pF, crit: critF, rule: `Reject H₀ if ${rule}` },
    generic: genericFormulas(h0, sigma, stat < 0 ? -1 : 1),
  };
}

/** The 12 cells of the whiteboard grid, in reading order. */
export const TWELVE = NULLS.flatMap((nl) =>
  (["known", "unknown"] as Sigma[]).flatMap((sg) =>
    (["p", "crit"] as Method[]).map((m) => ({ h0: nl.id, sigma: sg, method: m, key: `${nl.id}-${sg}-${m}` })),
  ),
);
