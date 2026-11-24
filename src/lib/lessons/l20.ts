// Lesson 20 (Get Ahead, BETA): residual analysis and the t test for a linear relationship.
// Not taught yet in Fall 2026: built from the Spring 2026 "Final announcement", the Spring 2026 Final and its
// solutions (Regression sheet, Q41: the critical-value test), the Fall 2025 Final (Residual Analysis sheet:
// predictions, residuals, LINE charts) and the textbook. Anticipations say so in `source`.
import { Sheet, int, pick, round, gauss, TOP, decide, DECISIONS, type BlockMaker, type Block, type Rng } from "./kit.ts";
import type { Lesson } from "./types.ts";
import {
  ols, writeReport, put, lit, simpleData, plausible, noise, devsq, meanOf, tinv, pTwo, SIMPLE, UNITS, type SCtx,
} from "./l19.ts";

const ALPHAS = [0.01, 0.05, 0.1];

/** |t| for a version that should be rejected (comfortably beyond the critical value) or not (comfortably inside). */
function targetT(rng: Rng, reject: boolean, alpha: number, df: number): number {
  const crit = tinv(1 - alpha / 2, df);
  return reject ? crit * 1.35 + 4 * rng() : 0.1 + 0.6 * crit * rng();
}
/** Two-tailed p-value formula in the class convention, the branch chosen by the sign of t. */
const pFormula = (tCell: string, dfCell: string, t: number) =>
  t < 0 ? `=2*T.DIST(${tCell},${dfCell},TRUE)` : `=2*(1-T.DIST(${tCell},${dfCell},TRUE))`;

// ---------- Q: predictions and residuals (Fall 2025 Final, Residual Analysis Q1–Q3) ----------
const residuals: BlockMaker = {
  key: "l20.residuals",
  title: "Predictions, residuals and the residual sum of squares",
  make(rng): Block {
    const ctx = pick(rng, SIMPLE);
    const n = 10;
    const { x, y } = simpleData(rng, ctx, n, 2 + 6 * rng());
    const o = ols([x], y);
    const [b0, b1] = o.b;
    const S = new Sheet();
    const top = TOP + 1;
    const T = S.table("B", top, ["Obs", ctx.x, ctx.y, "Prediction", "Residual"], x.map((v, i) => [i + 1, v, y[i]]));
    // The Prediction and Residual columns get headers only: their cells are answer cells.
    const xr = T.cols[ctx.x].range, yr = T.cols[ctx.y].range;
    const P = T.cols["Prediction"].c, E = T.cols["Residual"].c, X = T.cols[ctx.x].c, Y = T.cols[ctx.y].c;
    const L = "H", A = "K";
    S.header(`${L}${top}`, "Question").header(`${A}${top}`, "Your answer");
    const rB0 = top + 1, rB1 = top + 2, rSum = top + 4, rSS = top + 5, rSE = top + 6, rR2 = top + 7;
    put(S, `${L}${rB0}`, {
      label: "y-intercept", cell: `${A}${rB0}`, answer: b0, formula: `=INTERCEPT(${yr},${xr})`,
      explain: "INTERCEPT(Y range, X range): the y-intercept of the line of best fit.",
    });
    put(S, `${L}${rB1}`, {
      label: "slope", cell: `${A}${rB1}`, answer: b1, formula: `=SLOPE(${yr},${xr})`,
      explain: "SLOPE(Y range, X range): the slope of the line of best fit.",
    });
    for (let i = 0; i < n; i++) {
      const r = T.first + i;
      put(S, null, {
        label: `Prediction, observation ${i + 1}`, cell: `${P}${r}`, answer: o.fitted[i], formula: `=$${A}$${rB0}+$${A}$${rB1}*${X}${r}`,
        explain: "Prediction ŷ = y-intercept + slope × X. Lock the intercept and slope cells with $ so the formula fills down.",
        traps: [{ value: b1 + b0 * x[i], why: "Swapped the intercept and slope." }],
      });
      put(S, null, {
        label: `Residual, observation ${i + 1}`, cell: `${E}${r}`, answer: o.resid[i], formula: `=${Y}${r}-${P}${r}`,
        explain: "Residual = observed Y − predicted Y (actual minus prediction).",
        traps: [{ value: -o.resid[i], why: "Did prediction − observed: the residual is observed − predicted." }],
      });
    }
    const er = `${E}${T.first}:${E}${T.last}`;
    put(S, `${L}${rSum}`, {
      label: "Sum of the residuals", cell: `${A}${rSum}`, answer: o.resid.reduce((s, v) => s + v, 0), formula: `=SUM(${er})`,
      explain: "For the least-squares line the residuals always add up to 0 (up to tiny rounding): the line goes through the middle of the data.",
    });
    put(S, `${L}${rSS}`, {
      label: "Residual sum of squares", cell: `${A}${rSS}`, answer: o.sse, formula: `=SUMSQ(${er})`,
      explain: "Residual SS = Σ(y − ŷ)², the sum of the squared residuals: the Toolpak's ANOVA Residual SS.",
      traps: [{ value: devsq(y), why: "That is the Total SS (DEVSQ of Y)." }],
    });
    put(S, `${L}${rSE}`, {
      label: "Standard error of the estimate", cell: `${A}${rSE}`, answer: o.s, formula: `=SQRT(${A}${rSS}/(COUNT(${xr})-2))`,
      explain: "S = √(Residual SS ÷ (n − 2)): the typical size of a residual. It is the Toolpak's 'Standard Error' (Regression Statistics) and STEYX(Y range, X range).",
      traps: [{ value: Math.sqrt(o.sse / n), why: "Divided by n; the residual degrees of freedom are n − 2." }, { value: Math.sqrt(o.sse / (n - 1)), why: "Divided by n − 1; the residual degrees of freedom are n − 2." }],
    });
    put(S, `${L}${rR2}`, {
      label: "R² = 1 − Residual SS ÷ Total SS", cell: `${A}${rR2}`, answer: o.r2, formula: `=1-${A}${rSS}/DEVSQ(${yr})`, format: "prob",
      explain: "R² = 1 − Residual SS / Total SS. Self-check with =RSQ(Y range, X range).",
    });
    return {
      tab: "Residuals", title: "Predictions and residuals",
      text: [
        `${ctx.who} ${n} ${UNITS[ctx.xs]}: ${ctx.x} (X) and ${ctx.y} (Y), in B${top}:D${T.last}.`,
        `Find the line of best fit, then complete the Prediction and Residual columns (${P}${T.first}:${E}${T.last}) using your intercept and slope cells, as in the Fall 2025 Final.`,
        "Then find the sum of the residuals, the residual sum of squares, the standard error of the estimate and R². Formulas only, no rounding.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Run the Toolpak Regression with the 'Residuals' box ticked. Self-check: its RESIDUAL OUTPUT (Predicted and Residuals columns) matches yours, and the ANOVA Residual SS matches your residual sum of squares.",
        "Insert a scatter chart of the residuals (vertical) against X (horizontal): the predictor-residual chart. Self-check: the points sit either side of 0.",
      ],
    };
  },
};

// ---------- Q: the t test from the raw data ----------
const slopeTest: BlockMaker = {
  key: "l20.slopetest",
  title: "Testing for a linear relationship (t on n − 2 df)",
  make(rng): Block {
    const ctx = pick(rng, SIMPLE);
    const n = int(rng, 12, 25);
    const alpha = pick(rng, ALPHAS);
    const want = rng() < 0.5;
    const { x, y } = simpleData(rng, ctx, n, targetT(rng, want, alpha, n - 2));
    const o = ols([x], y);
    const b1 = o.b[1], se1 = o.se[1], t = o.t[1], df = n - 2;
    const lower = tinv(alpha / 2, df), upper = tinv(1 - alpha / 2, df);
    const p = pTwo(t, df);
    const reject = t < lower || t > upper;
    const S = new Sheet();
    const top = TOP + 1;
    const T = S.table("B", top, ["Obs", ctx.x, ctx.y], x.map((v, i) => [i + 1, v, y[i]]));
    const xr = T.cols[ctx.x].range, yr = T.cols[ctx.y].range;
    const L = "F", A = "I";
    S.header(`${L}${top}`, "Question").header(`${A}${top}`, "Your answer");
    S.label(`${L}${top + 1}`, "alpha").given(`${A}${top + 1}`, alpha);
    const rB = top + 2, rSE = top + 3, rT = top + 4, rDf = top + 5, rLo = top + 6, rHi = top + 7, rP = top + 8, rD = top + 9;
    put(S, `${L}${rB}`, { label: "slope b₁", cell: `${A}${rB}`, answer: b1, formula: `=SLOPE(${yr},${xr})`, explain: "SLOPE(Y range, X range)." });
    put(S, `${L}${rSE}`, {
      label: "standard error of the slope", cell: `${A}${rSE}`, answer: se1, formula: `=STEYX(${yr},${xr})/SQRT(DEVSQ(${xr}))`,
      explain: "S_b₁ = S ÷ √Σ(x − x̄)², where S = STEYX is the standard error of the estimate. It is the Standard Error next to the X coefficient in the Toolpak report.",
      traps: [{ value: o.s, why: "That is the standard error of the estimate S, not of the slope." }, { value: o.s / Math.sqrt(n), why: "Divided by √n: the slope's standard error divides by √DEVSQ(X)." }],
    });
    put(S, `${L}${rT}`, {
      label: "test statistic t", cell: `${A}${rT}`, answer: t, formula: `=${A}${rB}/${A}${rSE}`,
      explain: "t = (b₁ − 0) ÷ S_b₁: the null hypothesis says the true slope is 0. It is the Toolpak's t Stat for X.",
    });
    put(S, `${L}${rDf}`, {
      label: "degrees of freedom", cell: `${A}${rDf}`, answer: df, tol: 0, formula: `=COUNT(${xr})-2`,
      explain: "The slope's t statistic follows a t-distribution with n − 2 degrees of freedom (two estimated numbers: intercept and slope).",
      traps: [{ value: n - 1, why: "n − 1 is for a one-sample test of a mean; regression uses n − 2." }],
    });
    put(S, `${L}${rLo}`, {
      label: "lower critical value", cell: `${A}${rLo}`, answer: lower, formula: `=T.INV(${A}${top + 1}/2,${A}${rDf})`,
      explain: "Two tails: lower critical value = T.INV(α/2, n − 2).",
      traps: [{ value: tinv(alpha, df), why: "Used α instead of α/2: the test has two tails." }],
    });
    put(S, `${L}${rHi}`, {
      label: "upper critical value", cell: `${A}${rHi}`, answer: upper, formula: `=T.INV(1-${A}${top + 1}/2,${A}${rDf})`,
      explain: "Two tails: upper critical value = T.INV(1 − α/2, n − 2), as in the Spring 2026 Final solution.",
      traps: [{ value: tinv(1 - alpha, df), why: "Used 1 − α instead of 1 − α/2: the test has two tails." }, { value: tinv(1 - alpha / 2, n - 1), why: "Used n − 1 degrees of freedom." }],
    });
    put(S, `${L}${rP}`, {
      label: "p-value", cell: `${A}${rP}`, answer: p, format: "prob", formula: pFormula(`${A}${rT}`, `${A}${rDf}`, t),
      explain: t < 0 ? "t is negative, so p = 2 × T.DIST(t, n − 2, TRUE). It matches the Toolpak's P-value for X." : "t is positive, so p = 2 × (1 − T.DIST(t, n − 2, TRUE)), as in the Spring 2026 Final solution. It matches the Toolpak's P-value for X.",
      traps: [{ value: p / 2, why: "Forgot to double: the test is two-tailed." }, { value: 2 - p, why: "Used the wrong tail for the sign of t." }],
    });
    put(S, `${L}${rD}`, {
      label: "decision (R or DR)", cell: `${A}${rD}`, answer: decide(reject), options: DECISIONS,
      formula: `=IF(OR(${A}${rT}<${A}${rLo},${A}${rT}>${A}${rHi}),"R","DR")`,
      explain: reject
        ? "t lies in a rejection tail (and p < α): reject H₀. The data show a linear relationship between X and Y."
        : "t lies between the critical values (and p ≥ α): don't reject H₀. The data do not show a linear relationship.",
    });
    return {
      tab: "Slope t test", title: "Is there a linear relationship?",
      text: [
        `${ctx.who} ${n} ${UNITS[ctx.xs]}: ${ctx.x} (X) and ${ctx.y} (Y), in B${top}:D${T.last}.`,
        `Test the null hypothesis that there is no linear relationship between ${ctx.xs.toLowerCase()} and ${ctx.ys.toLowerCase()} (H₀: β₁ = 0 against H₁: β₁ ≠ 0) at the significance in ${A}${top + 1}, by critical values and by the p-value.`,
        "Use formulas that point at the data; one-tail functions only (T.DIST, T.INV). Write R or DR.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Run the Toolpak Regression on the data. Self-check: the X row's Standard Error, t Stat and P-value match your standard error, t and p-value.",
      ],
    };
  },
};

// ---------- Q: the Spring 2026 Final Q41 layout, from a Toolpak report ----------
const reportTest: BlockMaker = {
  key: "l20.reporttest",
  title: "The slope test from a Toolpak report (Spring 2026 Final Q41)",
  make(rng): Block {
    const ctx = pick(rng, SIMPLE);
    const n = int(rng, 15, 30);
    const alpha = pick(rng, ALPHAS);
    const want = rng() < 0.5;
    const { x, y } = simpleData(rng, ctx, n, targetT(rng, want, alpha, n - 2));
    const o = ols([x], y);
    const t = o.t[1], df = n - 2;
    const lower = tinv(alpha / 2, df), upper = tinv(1 - alpha / 2, df);
    const reject = t < lower || t > upper;
    const p = pTwo(t, df);
    const S = new Sheet();
    const top = TOP + 1;
    const T = S.table("B", top, ["Obs", ctx.x, ctx.y], x.map((v, i) => [i + 1, v, y[i]]));
    const xr = T.cols[ctx.x].range, yr = T.cols[ctx.y].range;
    const R = writeReport(S, "F", top, [ctx.x], o);
    const q = Math.max(T.last, R.bottom) + 2;
    const A = "H";
    S.header(`B${q}`, "Question").header(`${A}${q}`, "Your answer");
    S.label(`B${q + 1}`, "alpha").given(`${A}${q + 1}`, alpha);
    const rDf = q + 2, rT = q + 3, rLo = q + 4, rHi = q + 5, rD = q + 6, rP = q + 7, rSE = q + 8;
    put(S, `B${rDf}`, {
      label: "degrees of freedom", cell: `${A}${rDf}`, answer: df, tol: 0, formula: `=${R.obs}-2`,
      explain: "n − 2 (Observations − 2); it is also the Residual df in the ANOVA table.",
      traps: [{ value: n - 1, why: "n − 1 is the Total df; the slope test uses n − 2." }],
    });
    put(S, `B${rT}`, {
      label: "test statistic", cell: `${A}${rT}`, answer: t, formula: `=${R.coef[1]}/${R.seC[1]}`,
      explain: "Coefficient of X ÷ its Standard Error, exactly as the Spring 2026 Final solution (=L40/M40). It equals the report's t Stat.",
      traps: [{ value: o.t[0], why: "Used the Intercept row; the test is about the slope (the X row)." }],
    });
    put(S, `B${rLo}`, {
      label: "lower critical value", cell: `${A}${rLo}`, answer: lower, formula: `=T.INV(${A}${q + 1}/2,${A}${rDf})`,
      explain: "T.INV(α/2, n − 2).", traps: [{ value: tinv(alpha, df), why: "Used α instead of α/2." }],
    });
    put(S, `B${rHi}`, {
      label: "upper critical value", cell: `${A}${rHi}`, answer: upper, formula: `=T.INV(1-${A}${q + 1}/2,${A}${rDf})`,
      explain: "T.INV(1 − α/2, n − 2), as in the Spring 2026 Final solution (=T.INV(1-D32/2,D33)).",
      traps: [{ value: tinv(1 - alpha, df), why: "Used 1 − α instead of 1 − α/2." }],
    });
    put(S, `B${rD}`, {
      label: "decision (R or DR)", cell: `${A}${rD}`, answer: decide(reject), options: DECISIONS,
      formula: `=IF(OR(${A}${rT}<${A}${rLo},${A}${rT}>${A}${rHi}),"R","DR")`,
      explain: reject ? "The test statistic is in a rejection tail: R. The data are linearly related." : "The test statistic is between the critical values: DR. No evidence of a linear relationship.",
    });
    put(S, `B${rP}`, {
      label: "p-value (check against the report)", cell: `${A}${rP}`, answer: p, format: "prob", formula: pFormula(`${A}${rT}`, `${A}${rDf}`, t),
      explain: `${t < 0 ? "Negative t: 2 × T.DIST(t, df, TRUE)." : "Positive t: 2 × (1 − T.DIST(t, df, TRUE))."} It matches the P-value in the X row, and in simple regression also Significance F.`,
      traps: [{ value: p / 2, why: "Forgot to double: two tails." }],
    });
    put(S, `B${rSE}`, {
      label: "standard error of the slope from the raw data (check)", cell: `${A}${rSE}`, answer: o.se[1], formula: `=STEYX(${yr},${xr})/SQRT(DEVSQ(${xr}))`,
      explain: "S_b₁ = STEYX ÷ √DEVSQ(X): the same number as the report's Standard Error for X.",
    });
    return {
      tab: "Slope test from report", title: "Slope test from the Regression report",
      text: [
        `${ctx.who} ${n} ${UNITS[ctx.xs]}: ${ctx.x} (X) and ${ctx.y} (Y), in B${top}:D${T.last}. The Toolpak's Regression report is in F${top}:L${R.bottom}.`,
        `We test a null hypothesis which claims there is no linear relationship between ${ctx.xs.toLowerCase()} and ${ctx.ys.toLowerCase()}. For the significance in ${A}${q + 1}, decide whether to reject (R) or not reject (DR) by performing a critical value test.`,
        "Use the report's cells (coefficient and standard error) and one-tail T functions.",
      ],
      cells: S.cells, parts: S.parts,
      manual: ["Produce the report yourself from the data (Data Analysis > Regression, tick Labels). Self-check: it matches the one in the sheet."],
    };
  },
};

// ---------- Q: does the model fit? LINE checks with residual charts ----------
type Scenario = "good" | "curved" | "funnel";
function diagnose(x: number[], y: number[]) {
  const o = ols([x], y);
  const mx = meanOf(x);
  const tq = ols([x, x.map((v) => (v - mx) ** 2)], y).t[2];
  const idx = x.map((_, i) => i).sort((a, b) => x[a] - x[b]);
  const third = Math.floor(x.length / 3);
  const rms = (ids: number[]) => Math.sqrt(ids.reduce((s, i) => s + o.resid[i] ** 2, 0) / ids.length);
  const ratio = rms(idx.slice(-third)) / rms(idx.slice(0, third));
  return { o, tq, ratio };
}
function lineData(rng: Rng, ctx: SCtx, n: number, sc: Scenario): { x: number[]; y: number[] } {
  for (let k = 0; k < 400; k++) {
    let x: number[], y: number[];
    if (sc === "good") ({ x, y } = simpleData(rng, ctx, n, 6 + 4 * rng()));
    else {
      x = ctx.gen(rng, n);
      if (new Set(x).size < 4) continue;
      const sigma = ctx.sigma * (0.8 + 0.45 * rng());
      const b0 = ctx.b0 * (0.85 + 0.3 * rng());
      const b1 = (ctx.sign * 6 * sigma) / Math.sqrt(devsq(x));
      const mx = meanOf(x), half = (Math.max(...x) - Math.min(...x)) / 2;
      if (sc === "curved") {
        const c = ((rng() < 0.5 ? -1 : 1) * (3.5 + 2 * rng()) * sigma) / (half * half);
        const e = noise(rng, [x], sigma);
        y = x.map((v, i) => round(b0 + b1 * v + c * (v - mx) ** 2 + e[i], ctx.yd));
      } else {
        const lo = Math.min(...x);
        const w = x.map((v) => 0.15 + (1.85 * (v - lo)) / (2 * half));
        y = x.map((v, i) => round(b0 + b1 * v + 1.6 * sigma * w[i] * gauss(rng), ctx.yd));
      }
    }
    if (!plausible(ctx, y)) continue;
    const d = diagnose(x, y);
    const aq = Math.abs(d.tq);
    if (sc === "good" && aq < 1 && d.ratio > 0.75 && d.ratio < 1.33) return { x, y };
    if (sc === "curved" && aq > 6 && d.ratio > 0.5 && d.ratio < 2) return { x, y };
    if (sc === "funnel" && aq < 2 && d.ratio > 3) return { x, y };
  }
  throw new Error(`lineData: could not make a clear ${sc} data set`);
}
const PATTERNS = ["None", "Linearity", "Equal variances"];
const lineCheck: BlockMaker = {
  key: "l20.linecheck",
  title: "Checking the LINE assumptions with residual charts",
  make(rng): Block {
    const ctx = pick(rng, SIMPLE);
    const n = 30;
    const sc = pick(rng, ["good", "curved", "funnel"] as const);
    const { x, y } = lineData(rng, ctx, n, sc);
    const o = ols([x], y);
    const S = new Sheet();
    const top = TOP + 1;
    const T = S.table("B", top, ["Obs", ctx.x, ctx.y], x.map((v, i) => [i + 1, v, y[i]]));
    const xr = T.cols[ctx.x].range, yr = T.cols[ctx.y].range;
    const L = "F", A = "J";
    S.header(`${L}${top}`, "Question").header(`${A}${top}`, "Your answer");
    const rB0 = top + 1, rB1 = top + 2, rR2 = top + 3, rE1 = top + 4, rPat = top + 6, rOk = top + 7;
    put(S, `${L}${rB0}`, { label: "y-intercept", cell: `${A}${rB0}`, answer: o.b[0], formula: `=INTERCEPT(${yr},${xr})`, explain: "INTERCEPT(Y range, X range)." });
    put(S, `${L}${rB1}`, { label: "slope", cell: `${A}${rB1}`, answer: o.b[1], formula: `=SLOPE(${yr},${xr})`, explain: "SLOPE(Y range, X range)." });
    put(S, `${L}${rR2}`, { label: "R²", cell: `${A}${rR2}`, answer: o.r2, format: "prob", formula: `=RSQ(${yr},${xr})`, explain: "RSQ(Y range, X range). A high R² does not by itself mean the linear model is appropriate: look at the residuals." });
    put(S, `${L}${rE1}`, {
      label: "residual of observation 1", cell: `${A}${rE1}`, answer: o.resid[0], formula: `=D${T.first}-(${A}${rB0}+${A}${rB1}*C${T.first})`,
      explain: "Residual = observed − predicted = y − (b₀ + b₁x).", traps: [{ value: -o.resid[0], why: "Did predicted − observed." }],
    });
    const pat = sc === "good" ? "None" : sc === "curved" ? "Linearity" : "Equal variances";
    put(S, `${L}${rPat}`, {
      label: `Which assumption does the predictor-residual chart most clearly call into question? (${PATTERNS.join(" / ")})`, cell: `${A}${rPat}`,
      answer: pat, options: PATTERNS, formula: lit(pat),
      explain: sc === "good"
        ? "The residuals scatter randomly around 0 with about the same spread for every X: no curve and no funnel, so the chart supports linearity and equal variances."
        : sc === "curved"
          ? "The residuals follow a curve (one sign at both ends, the other in the middle): the relationship is not a straight line, so linearity fails."
          : "The spread of the residuals grows as X grows (a funnel shape): the residuals do not all have the same variance, so equal variances fails.",
    });
    put(S, `${L}${rOk}`, {
      label: "Is a simple linear regression model appropriate for these data? (Yes / No)", cell: `${A}${rOk}`, answer: sc === "good" ? "Yes" : "No", options: ["Yes", "No"],
      formula: lit(sc === "good" ? "Yes" : "No"),
      explain: sc === "good"
        ? "Yes: the scatter shows a straight-line pattern and the residuals look like random noise with constant spread."
        : `No: ${sc === "curved" ? "the points bend away from the line, so a straight line misdescribes the relationship" : "the scatter fans out, so predictions are much less reliable for large X than for small X"}, whatever R² says.`,
    });
    return {
      tab: "LINE checks", title: "Does the linear model fit?",
      text: [
        `${ctx.who} ${n} ${UNITS[ctx.xs]}: ${ctx.x} (X) and ${ctx.y} (Y), in B${top}:D${T.last}.`,
        "Fit the line of best fit, then make a Prediction and a Residual column next to the data and draw the predictor-residual chart (X horizontal, residual vertical).",
        "Use the charts to judge the LINE assumptions and whether a simple linear model is appropriate.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Scatter chart of Y against X with a linear trendline. Self-check: for a curved data set the points bend away from the line at the ends or in the middle.",
        "Predictor-residual chart (scatter of residuals against X). Self-check: random scatter about 0 supports equal variances; a funnel (spread growing with X) does not; a curve means linearity fails.",
        "Histogram of the residuals with the Toolpak (Data Analysis > Histogram). Self-check: roughly bell-shaped and centred at 0 supports normality.",
        "Ordered-residuals chart: the residuals plotted in observation order (Obs on the horizontal axis). Self-check: no runs or trend over the order supports independence.",
        "Write one or two sentences for each chart saying whether it supports the assumption and why, as the Fall 2025 Final asked.",
      ],
    };
  },
};

// =====================================================================================================

export const LESSON_20: Lesson = {
  n: 20,
  title: "Residual analysis and the test for a linear relationship",
  unit: 3,
  week: "Week 14 · Wed 2 Dec · Residual analysis",
  beta: true,
  sources: [
    "Final announcement.docx (Spring 2026: the simple linear regression syllabus)",
    "Final.docx and S26_Final.xlsx (Spring 2026 Final, Q41)",
    "S26_Final, solutions.xlsx (Regression sheet C32:D38 and the Toolpak report K23:S40)",
    "F25_Final.xlsx (Residual Analysis sheet, Q1–Q5)",
    "Textbook: Berenson, Levine, Szabat, Basic Business Statistics, 14th ed., simple linear regression chapter (residual analysis, inferences about the slope)",
  ],
  summary: "A residual is what the line of best fit gets wrong for each observation (observed minus predicted); the residuals let you check the LINE assumptions with three charts and measure how far the data scatter from the line. Using the slope's standard error you can test whether the data are linearly related at all, with a t statistic on n − 2 degrees of freedom.",
  defs: [
    { term: "Residual", text: "The residual of an observation is observed Y minus predicted Y: e = y − ŷ, where ŷ = b₀ + b₁x. Positive: the point is above the line; negative: below it. (The Fall 2025 Final's Table 12 had a Prediction column and then a Residuals column.)", source: "F25 Final › Residual Analysis F5:G5 and Q3; definition: anticipated · textbook, residual analysis" },
    { term: "Residuals add to zero; Residual SS", text: "For the least-squares line the residuals always sum to 0. The sum of their squares Σ(y − ŷ)² is the residual sum of squares, the Toolpak's ANOVA Residual SS (=SUMSQ of the residual column).", source: "Anticipated · textbook, simple linear regression chapter" },
    { term: "Standard error of the estimate", text: "S = √(Residual SS ÷ (n − 2)), the typical distance of a point from the line. The Toolpak prints it as 'Standard Error' under Regression Statistics; Excel's STEYX(Y range, X range) gives it directly.", source: "Anticipated · textbook, standard error of the estimate; Toolpak report layout from S26 Final, solutions › Regression K29" },
    { term: "LINE assumptions", text: "The LINE acronym of assumptions for a linear regression model: Linearity; Independence; Normality; Equal variances. Equivalently, the residuals are independent and all normally distributed with mean zero and the same variance.", source: "Spring 2026 Final announcement (regression bullet 4)" },
    { term: "Charts that check the assumptions", text: "Independence: ordered-residuals chart (residuals in observation order). Normality: histogram of residuals. Equal variances: predictor-residual chart (residuals against X). Linearity: the scatter plot with trendline (and no curve in the residual chart).", source: "F25 Final › Residual Analysis Q5 (a)–(c); Spring 2026 Final announcement (residual histogram and predictor-residual scatter)" },
    { term: "Reading the residual charts", text: "Supports the assumption: residuals scattered randomly around 0 with the same spread everywhere (predictor-residual and ordered charts) and a roughly bell-shaped histogram centred at 0. Problems: a curve (linearity fails), a funnel where the spread grows or shrinks with X (equal variances fails), runs or trends over time (independence fails), a skewed histogram (normality fails).", source: "Anticipated · textbook, residual analysis" },
    { term: "Is a simple linear model appropriate?", text: "Only if the scatter shows a straight-line pattern and the residual charts show no pattern. A high R² is not enough: in the Fall 2025 Final's hours-studied data many scores sit at the 100% ceiling, so the points bend and the residuals curve even though R² ≈ 0.79.", source: "F25 Final › Residual Analysis Q4 (our analysis of its data: no official solution available)" },
    { term: "Testing for a linear relationship", text: "Null hypothesis: the data are not linearly related, H₀: β₁ = 0 (the true slope is zero); alternative H₁: β₁ ≠ 0. Two-tailed.", source: "Spring 2026 Final announcement (regression bullet 3); Spring 2026 Final Q41" },
    { term: "Test statistic for the slope", text: "t = b₁ ÷ S_b₁: the X coefficient divided by its standard error, both read from the regression report (his solution: =L40/M40). It follows a t-distribution with n − 2 degrees of freedom.", source: "Spring 2026 Final, solutions › Regression D33:D34; Spring 2026 Final announcement" },
    { term: "Standard error of the slope", text: "S_b₁ = S ÷ √Σ(x − x̄)², in Excel =STEYX(Y range, X range)/SQRT(DEVSQ(X range)): the Standard Error in the X row of the Toolpak report.", source: "Anticipated · textbook, inferences about the slope (checked against S26 Final, solutions › Regression M40)" },
    { term: "Critical values, p-value and decision", text: "Critical values ±T.INV(1 − α/2, n − 2) (his solution: =T.INV(1-D32/2,D33)); reject if t is beyond them. p-value: 2*(1-T.DIST(t,n−2,TRUE)) for t > 0 (his solution), 2*T.DIST(t,n−2,TRUE) for t < 0; reject if p < α. The Toolpak's P-value for X (and, in simple regression, Significance F) is this same p-value.", source: "Spring 2026 Final, solutions › Regression D36, D38, O40, P34" },
  ],
  examples: [
    {
      title: "Property prices: is there a linear relationship? (Spring 2026 Final Q41)",
      setup: "We test a null hypothesis which claims there is no linear relationship between bedrooms and price (20 properties). For α = 0.01, decide R or DR by a critical value test. His Toolpak report has the Bedrooms coefficient in L40 and its standard error in M40.",
      table: { head: ["", "Coefficients", "Standard Error", "t Stat", "P-value"], rows: [["Intercept", 27008.09, 110713.93, 0.2439, 0.8100], ["Bedrooms", 87909.48, 27255.89, 3.2253, 0.004693]] },
      steps: [
        { say: "alpha (D32)", result: "0.01" },
        { say: "degrees of freedom = n − 2 (D33; he typed it)", result: "18" },
        { say: "test statistic = coefficient ÷ standard error", formula: "=L40/M40", result: "3.2253" },
        { say: "upper critical value (lower is its negative, =T.INV(D32/2,D33) = −2.8784)", formula: "=T.INV(1-D32/2,D33)", result: "2.8784" },
        { say: "3.2253 > 2.8784, so the statistic is in the upper rejection tail", result: "R" },
        { say: "His p-value check (t > 0)", formula: "=2*(1-T.DIST(D34,18,TRUE))", result: "0.004693 (< 0.01, and equal to the report's P-value)" },
        { say: "The slope's standard error from the raw data, to see where M40 comes from", formula: "=STEYX(D4:D23,E4:E23)/SQRT(DEVSQ(E4:E23))", result: "27255.8855" },
      ],
      takeaway: "t = coefficient ÷ standard error on n − 2 df; two tails, so the critical values use α/2.",
      source: "Spring 2026 Final, solutions › Regression C32:D38 and K38:Q40",
    },
    {
      title: "Hours studied and exam scores: residual analysis (Fall 2025 Final)",
      setup: "Table 12 shows the percentage score of students in an exam and the hours they studied (the sheet says 64 students; the table has 68 rows, D6:E73). Find the line, complete the Prediction and Residuals columns, and judge whether a simple regression model is appropriate.",
      steps: [
        { say: "y-intercept (he asked for it in K20)", formula: "=INTERCEPT(E6:E73,D6:D73)", result: "19.2307" },
        { say: "slope (K22)", formula: "=SLOPE(E6:E73,D6:D73)", result: "4.4627" },
        { say: "R²", formula: "=RSQ(E6:E73,D6:D73)", result: "0.7922" },
        { say: "Prediction in F6, filled down", formula: "=$K$20+$K$22*D6" },
        { say: "Residual in G6, filled down", formula: "=E6-F6" },
        { say: "How many scores are at the 100% ceiling?", formula: "=COUNTIF(E6:E73,100)", result: "23" },
        { say: "Average residual by quarter of hours studied (lowest to highest): about −0.2, −14.1, +19.1, −4.8. The residuals curve (negative, then positive, then negative) because scores cannot go past 100." },
        { say: "Conclusion: despite R² ≈ 0.79 the relationship is not a straight line, so the linearity assumption fails and a simple linear model is not really appropriate." },
      ],
      takeaway: "Judge the fit from the residual charts, not from R² alone.",
      source: "F25 Final › Residual Analysis (data and questions are his; there is no official solution, the numbers and judgement are ours)",
    },
  ],
  quiz: [
    { q: "A house is predicted to sell for $310,000 and actually sells for $295,000. What is its residual?", options: ["−$15,000", "$15,000", "$295,000", "$605,000"], answer: 0, why: "Residual = observed − predicted = 295,000 − 310,000." },
    { q: "For a least-squares line, the residuals always…", options: ["add up to 0", "are all positive", "add up to the Total SS", "equal the predictions"], answer: 0, why: "The best-fit line passes through the middle of the data, so the positive and negative residuals cancel." },
    { q: "What does LINE stand for?", options: ["Linearity, Independence, Normality, Equal variances", "Least squares, Intercept, Normality, Error", "Linearity, Intercept, No outliers, Equal means", "Line, Independence, Null, Estimate"], answer: 0, why: "His four assumptions: linearity; independence; normality; equal variances." },
    { q: "Which chart did the Fall 2025 Final use to assess equal variances?", options: ["The predictor-residual chart", "The histogram of residuals", "The ordered-residuals chart", "A pie chart of the residuals"], answer: 0, why: "Equal variances: predictor-residual chart. Normality: histogram. Independence: ordered residuals." },
    { q: "The predictor-residual chart shows the residuals spreading out more and more as X increases (a funnel). Which assumption is in doubt?", options: ["Equal variances", "Normality", "Independence", "None, this is expected"], answer: 0, why: "A funnel means the residuals do not all have the same variance." },
    { q: "The residuals form a U-shape against X. What does that suggest?", options: ["The relationship is not linear", "The residuals are not independent of each other in time", "The sample size is too small", "The model is perfect"], answer: 0, why: "A systematic curve means a straight line is the wrong shape for the data: linearity fails." },
    { q: "In the test that the data are not linearly related, what is the null hypothesis?", options: ["The true slope is 0", "The true intercept is 0", "R² = 1", "The residuals are normal"], answer: 0, why: "No linear relationship means β₁ = 0; the Toolpak's X-row t Stat and P-value test exactly this." },
    { q: "A simple regression uses 20 observations. How many degrees of freedom does the slope's t statistic have?", options: ["18", "19", "20", "1"], answer: 0, why: "n − 2 = 18, as in the Spring 2026 Final." },
    { q: "The report shows coefficient 87909.48 and standard error 27255.89 for X, n = 20, α = 0.01 (critical values ±2.878). Decision?", options: ["R, since t = 3.23 is beyond 2.878", "DR, since t = 3.23 is below 87909", "DR, since 0.0047 > 0.01", "R, since the coefficient is positive"], answer: 0, why: "t = 87909.48/27255.89 = 3.2253 > 2.8784, so reject (p = 0.0047 < 0.01 agrees)." },
    { q: "Which Excel formula gives the standard error of the estimate directly?", options: ["=STEYX(Y range, X range)", "=STDEV.S(Y range)", "=DEVSQ(Y range)", "=CORREL(X range, Y range)"], answer: 0, why: "STEYX = √(Residual SS ÷ (n − 2)), the Toolpak's Standard Error. STDEV.S of Y ignores the line." },
  ],
  excel: [
    { fn: "Prediction and residual columns", use: "Prediction =$K$20+$K$22*D6 (intercept and slope cells locked with $), Residual =E6-F6 (observed − predicted), then fill down." },
    { fn: "SUMSQ / STEYX", use: "=SUMSQ(residual column) is the Residual SS; =STEYX(Y range, X range) is the standard error of the estimate √(Residual SS/(n − 2))." },
    { fn: "STEYX/SQRT(DEVSQ(X))", use: "The standard error of the slope, the same as the Toolpak's Standard Error in the X row." },
    { fn: "T.INV", use: "Critical values for the slope test: =T.INV(α/2, n−2) and =T.INV(1−α/2, n−2)." },
    { fn: "T.DIST", use: "Two-tailed p-value by the sign of t: =2*(1-T.DIST(t,n−2,TRUE)) if t > 0, =2*T.DIST(t,n−2,TRUE) if t < 0. Never T.DIST.2T." },
    { fn: "Toolpak Regression with Residuals", use: "Tick 'Residuals' (and optionally 'Residual Plots') to get a RESIDUAL OUTPUT table of predictions and residuals." },
    { fn: "Toolpak Histogram", use: "Histogram of the residuals to check normality (choose evenly spaced bins)." },
    { fn: "Scatter charts", use: "Predictor-residual chart: X horizontal, residuals vertical. Ordered-residuals chart: observation number horizontal, residuals vertical." },
  ],
  watch: [
    "BETA: this lesson has not been taught yet (Wed 2 Dec). It is built from last spring's final announcement, the Spring 2026 and Fall 2025 finals and the textbook, and will be replaced by Dr Arathoon's own notes once taught. Which of the two regression classes covers the t test is our guess.",
    "Spring 2026 Final Q41 [4 points]: test the null hypothesis that there is no linear relationship between bedrooms and price at α = 0.01 by a critical value test. His answer cells: alpha, degrees of freedom (18), test statistic (=L40/M40), lower and upper critical values (=T.INV(1-D32/2,D33)), decision (R).",
    "Fall 2025 Final, Residual Analysis Q3–Q5: complete the Prediction and Residuals columns from your intercept and slope; say whether a simple regression model is appropriate (2 points, written); for the I, N and E assumptions produce the ordered-residuals chart, the histogram of residuals and the predictor-residual chart, and write whether each chart supports the assumption and why ('in good English', 3 points each).",
    "Common slips: residual as predicted − observed; n − 1 instead of n − 2 degrees of freedom; one-tailed critical values (α instead of α/2); testing the Intercept row instead of the X row; trusting a high R² without looking at the residual charts.",
  ],
  makers: [residuals, slopeTest, reportTest, lineCheck],
};
