// Lesson 21 (Get Ahead, BETA): multiple linear regression.
// Not taught yet in Fall 2026, and there are no notes for it. The one past-exam appearance is the Fall 2025 Final's
// Regression sheet (a 0/1 dummy variable for wine type, a Toolpak multiple regression, a prediction). Everything else
// is anticipated from the textbook in the style he examines simple regression; `source` says which is which.
//
// The engine has no LINEST, so each tab computes the regression in TypeScript (normal equations, see l19.ts) and puts
// a Toolpak-style SUMMARY OUTPUT in the sheet as given values; students run the Toolpak themselves to confirm it.
import { Sheet, int, pick, round, TOP, decide, DECISIONS, type BlockMaker, type Block, type Rng } from "./kit.ts";
import type { Lesson } from "./types.ts";
import { ols, writeReport, put, lit, fmt, noise, meanOf, pTwo, type Ols } from "./l19.ts";

const ALPHAS = [0.01, 0.05, 0.1];
const pFormula = (tCell: string, dfCell: string, t: number) =>
  t < 0 ? `=2*T.DIST(${tCell},${dfCell},TRUE)` : `=2*(1-T.DIST(${tCell},${dfCell},TRUE))`;

type XV = { name: string; short: string; gen: (rng: Rng, n: number) => number[]; sign: 1 | -1 };
type MCtx = { who: string; unit: string; y: string; ys: string; ymean: number; sigma: number; yd: number; xs: XV[] };
const U = (lo: number, hi: number, d: number) => (rng: Rng, n: number) => Array.from({ length: n }, () => round(lo + (hi - lo) * rng(), d));
const I = (lo: number, hi: number) => (rng: Rng, n: number) => Array.from({ length: n }, () => int(rng, lo, hi));

const MULTI: MCtx[] = [
  {
    who: "An estate agent records the sale price of", unit: "houses", y: "Price ($000)", ys: "Price", ymean: 420, sigma: 30, yd: 1, xs: [
      { name: "Size (00 sq ft)", short: "Size", gen: U(10, 40, 1), sign: 1 },
      { name: "Age (years)", short: "Age", gen: I(0, 60), sign: -1 },
      { name: "Distance (miles)", short: "Distance", gen: U(1, 25, 1), sign: -1 },
    ],
  },
  {
    who: "A retailer records the weekly sales of", unit: "stores", y: "Sales ($000)", ys: "Sales", ymean: 120, sigma: 8, yd: 1, xs: [
      { name: "TV ads ($000)", short: "TV", gen: U(0, 20, 1), sign: 1 },
      { name: "Online ads ($000)", short: "Online", gen: U(0, 15, 1), sign: 1 },
      { name: "Price ($)", short: "Price", gen: U(8, 14, 2), sign: -1 },
    ],
  },
  {
    who: "An HR team records the salary of", unit: "employees", y: "Salary ($000)", ys: "Salary", ymean: 75, sigma: 6, yd: 1, xs: [
      { name: "Experience (years)", short: "Experience", gen: I(0, 25), sign: 1 },
      { name: "Education (years)", short: "Education", gen: I(12, 20), sign: 1 },
      { name: "Hours per week", short: "Hours", gen: I(30, 60), sign: 1 },
    ],
  },
  {
    who: "A tutor records the exam score of", unit: "students", y: "Score", ys: "Score", ymean: 68, sigma: 5, yd: 0, xs: [
      { name: "Hours studied", short: "Studied", gen: U(0, 20, 1), sign: 1 },
      { name: "Hours slept", short: "Slept", gen: U(4, 9, 1), sign: 1 },
      { name: "Hours worked", short: "Worked", gen: U(0, 20, 1), sign: -1 },
    ],
  },
  {
    who: "A courier records the delivery time of", unit: "deliveries", y: "Time (min)", ys: "Time", ymean: 45, sigma: 3, yd: 1, xs: [
      { name: "Distance (miles)", short: "Distance", gen: U(1, 15, 1), sign: 1 },
      { name: "Items", short: "Items", gen: I(1, 12), sign: 1 },
      { name: "Traffic index", short: "Traffic", gen: U(1, 10, 1), sign: 1 },
    ],
  },
];

/**
 * Data whose fitted coefficients have (before y is rounded) exactly the t statistics asked for: |t| between 4 and 8
 * for a significant variable, between 0.05 and 1.45 (p > 0.15 for the sizes used) for one that is not.
 */
function multiData(rng: Rng, xs: number[][], ymean: number, sigma0: number, yd: number, signif: boolean[], signs: (1 | -1)[]): number[] {
  const n = xs[0].length;
  const sigma = sigma0 * (0.8 + 0.45 * rng());
  const e = noise(rng, xs, sigma);
  const inv = ols(xs, e).inv;
  const beta = xs.map((_, j) => {
    const t = signif[j] ? 4 + 4 * rng() : 0.05 + 1.4 * rng();
    const s = signif[j] ? signs[j] : rng() < 0.5 ? -1 : 1;
    return s * t * sigma * Math.sqrt(inv[j + 1][j + 1]);
  });
  const b0 = ymean - beta.reduce((s, b, j) => s + b * meanOf(xs[j]), 0);
  return Array.from({ length: n }, (_, i) => round(b0 + beta.reduce((s, b, j) => s + b * xs[j][i], 0) + e[i], yd));
}
/** Which of k variables are significant: always at least one of each kind. */
function roles(rng: Rng, k: number): boolean[] {
  const nIns = k > 2 && rng() < 0.3 ? 2 : 1;
  const out = Array(k).fill(true) as boolean[];
  const ids = Array.from({ length: k }, (_, i) => ({ i, r: rng() })).sort((a, b) => a.r - b.r);
  for (let j = 0; j < nIns; j++) out[ids[j].i] = false;
  return out;
}
function multiSet(rng: Rng, ctx: MCtx, n: number) {
  const X = ctx.xs.map((v) => v.gen(rng, n));
  const sig = roles(rng, X.length);
  const y = multiData(rng, X, ctx.ymean, ctx.sigma, ctx.yd, sig, ctx.xs.map((v) => v.sign));
  return { X, y, o: ols(X, y) };
}
/** The most decimal places among a column's values (so a new case looks like the data). */
const decs = (c: number[]) => Math.max(...c.map((v) => String(v).split(".")[1]?.length ?? 0));
/** Data columns Obs | Y | X1 | X2 | X3 from (B, top), X columns side by side as the Toolpak needs. */
function dataTable(S: Sheet, top: number, ctx: MCtx, X: number[][], y: number[]) {
  const T = S.table("B", top, ["Obs", ctx.y, ...ctx.xs.map((v) => v.name)], y.map((v, i) => [i + 1, v, ...X.map((c) => c[i])]));
  return { T, yr: T.cols[ctx.y].range, xr: `${T.cols[ctx.xs[0].name].c}${T.first}:${T.cols[ctx.xs[ctx.xs.length - 1].name].c}${T.last}` };
}

// ---------- Q: predictions, interpretation, R², adjusted R², F ----------
const predict: BlockMaker = {
  key: "l21.predict",
  title: "Multiple regression report: predictions, adjusted R² and the F test",
  make(rng): Block {
    const ctx = pick(rng, MULTI);
    const n = int(rng, 20, 30);
    const { X, y, o } = multiSet(rng, ctx, n);
    const k = X.length;
    const S = new Sheet();
    const top = TOP + 1;
    const { T, yr, xr } = dataTable(S, top, ctx, X, y);
    const R = writeReport(S, "H", top, ctx.xs.map((v) => v.name), o);
    const q = Math.max(T.last, R.bottom) + 2;
    const A = "J";
    const alpha = pick(rng, ALPHAS);
    const v = X.map((c) => round(Math.min(...c) + (Math.max(...c) - Math.min(...c)) * (0.25 + 0.5 * rng()), decs(c)));
    const jx = int(rng, 0, k - 1);
    const delta = pick(rng, [2, 3, 5, 10]);
    S.header(`B${q}`, "Question").header(`${A}${q}`, "Your answer");
    ctx.xs.forEach((xv, j) => S.label(`B${q + 1 + j}`, `New case: ${xv.name}`).given(`${A}${q + 1 + j}`, v[j]));
    const rD = q + 1 + k, rAl = rD + 1;
    S.label(`B${rD}`, `Increase in ${ctx.xs[jx].name} (others unchanged)`).given(`${A}${rD}`, delta);
    S.label(`B${rAl}`, "alpha").given(`${A}${rAl}`, alpha);
    const rP = rAl + 1, rC = rAl + 2, rQ = rAl + 3, rAdj = rAl + 4, rF = rAl + 5, rDec = rAl + 6;
    const pred = o.b[0] + o.b.slice(1).reduce((s, b, j) => s + b * v[j], 0);
    put(S, `B${rP}`, {
      label: `Predicted ${ctx.ys.toLowerCase()} for the new case`, cell: `${A}${rP}`, answer: pred,
      formula: `=${R.coef[0]}+${ctx.xs.map((_, j) => `${R.coef[j + 1]}*${A}${q + 1 + j}`).join("+")}`,
      explain: "ŷ = b₀ + b₁x₁ + b₂x₂ + b₃x₃: plug every X of the new case into the fitted equation, as the Fall 2025 Final asked for the wine.",
      traps: [{ value: pred - o.b[0], why: "Forgot the intercept." }, ...ctx.xs.map((_, j) => ({ value: pred - o.b[j + 1] * v[j], why: `Left out the ${ctx.xs[j].short} term.` }))],
    });
    put(S, `B${rC}`, {
      label: `Change in predicted ${ctx.ys.toLowerCase()} for that increase in ${ctx.xs[jx].short}`, cell: `${A}${rC}`, answer: delta * o.b[jx + 1],
      formula: `=${A}${rD}*${R.coef[jx + 1]}`,
      explain: `The coefficient of ${ctx.xs[jx].short} is the change in predicted Y for one more unit of it, holding the other X variables fixed; for ${delta} units multiply by ${delta}.`,
      traps: [{ value: delta * o.t[jx + 1], why: "Used the t Stat, not the coefficient." }],
    });
    put(S, `B${rQ}`, {
      label: "R² from the ANOVA table", cell: `${A}${rQ}`, answer: o.r2, format: "prob", formula: `=${R.ssR}/${R.ssT}`,
      explain: "R² = Regression SS ÷ Total SS: the share of the variation in Y explained by all the X variables together.",
      traps: [{ value: o.multR, why: "Multiple R is √R², not R²." }],
    });
    put(S, `B${rAdj}`, {
      label: "Adjusted R² from R² (check against the report)", cell: `${A}${rAdj}`, answer: o.adj, format: "prob",
      formula: `=1-(1-${R.r2})*(${R.obs}-1)/(${R.obs}-${k}-1)`,
      explain: `Adjusted R² = 1 − (1 − R²)(n − 1)/(n − k − 1) with k = ${k} X variables. It penalises extra variables, so it is a little below R².`,
      traps: [{ value: 1 - ((1 - o.r2) * (n - 1)) / (n - 2), why: "Used n − 2 (simple regression); with k X variables it is n − k − 1." }],
    });
    put(S, `B${rF}`, {
      label: "F statistic = Regression MS ÷ Residual MS", cell: `${A}${rF}`, answer: o.F, formula: `=${R.msR}/${R.msE}`,
      explain: "MS = SS ÷ df; F = MS Regression ÷ MS Residual, with k and n − k − 1 degrees of freedom.",
      traps: [{ value: o.ssr / o.sse, why: "Divided the SS, not the MS (each SS must be divided by its df)." }],
    });
    const rej = o.sigF < alpha;
    put(S, `B${rDec}`, {
      label: "Overall F test: H₀ all slopes are 0 (R or DR)", cell: `${A}${rDec}`, answer: decide(rej), options: DECISIONS,
      formula: `=IF(${R.sigF}<${A}${rAl},"R","DR")`,
      explain: rej
        ? "Significance F is the p-value of the overall test; it is below α, so reject: at least one X variable helps predict Y."
        : "Significance F is not below α: don't reject; the X variables together do not significantly predict Y.",
    });
    return {
      tab: "Multiple regression", title: "Reading a multiple regression report",
      text: [
        `${ctx.who} ${n} ${ctx.unit} with ${k} possible explanatory variables, in B${top}:${T.cols[ctx.xs[k - 1].name].c}${T.last}.`,
        `The Toolpak's Regression report (Input Y Range = ${yr}, Input X Range = ${xr}) is in H${top}:N${R.bottom}.`,
        "Answer with formulas that point at the report's cells. Do not round.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Run Data Analysis > Regression yourself: Input Y Range = the ${ctx.y} column, Input X Range = all ${k} X columns at once (they must sit side by side), tick Labels. Self-check: your output matches the report in the sheet.`,
      ],
    };
  },
};

// ---------- Q: which variables matter? t Stat, P-value, dropping one ----------
const signif: BlockMaker = {
  key: "l21.signif",
  title: "Significance of each variable and dropping the weakest",
  make(rng): Block {
    const ctx = pick(rng, MULTI);
    const n = int(rng, 20, 30);
    const { X, y, o } = multiSet(rng, ctx, n);
    const k = X.length, df = n - k - 1;
    const alpha = pick(rng, ALPHAS);
    const S = new Sheet();
    const top = TOP + 1;
    const { T, yr } = dataTable(S, top, ctx, X, y);
    const R = writeReport(S, "H", top, ctx.xs.map((v) => v.name), o);
    // The variable to drop first: the largest P-value, when it is above alpha.
    let jd = 0;
    for (let j = 1; j < k; j++) if (o.p[j + 1] > o.p[jd + 1]) jd = j;
    const red: Ols = ols(X.filter((_, j) => j !== jd), y);
    const rr = R.bottom + 2;
    S.header(`H${rr}`, "Regression Statistics after dropping the variable with the largest P-value");
    S.label(`H${rr + 1}`, "R Square").given(`I${rr + 1}`, red.r2);
    S.label(`H${rr + 2}`, "Adjusted R Square").given(`I${rr + 2}`, red.adj);
    const q = Math.max(T.last, rr + 2) + 2;
    const A = "J";
    S.header(`B${q}`, "Question").header(`${A}${q}`, "Your answer");
    S.label(`B${q + 1}`, "alpha").given(`${A}${q + 1}`, alpha);
    const rDf = q + 2;
    put(S, `B${rDf}`, {
      label: "degrees of freedom for the coefficient t tests", cell: `${A}${rDf}`, answer: df, tol: 0, formula: `=COUNT(${yr})-${k}-1`,
      explain: `n − k − 1 = ${n} − ${k} − 1: the Residual df in the ANOVA table.`,
      traps: [{ value: n - 2, why: "n − 2 is for simple regression (one X)." }, { value: n - 1, why: "n − 1 is the Total df." }],
    });
    let r = rDf + 1;
    ctx.xs.forEach((xv, j) => {
      const t = o.t[j + 1], p = o.p[j + 1];
      const rt = r++, rp = r++, rd = r++;
      put(S, `B${rt}`, {
        label: `t Stat for ${xv.name}`, cell: `${A}${rt}`, answer: t, formula: `=${R.coef[j + 1]}/${R.seC[j + 1]}`,
        explain: "t = coefficient ÷ its standard error (H₀: this variable's true coefficient is 0, holding the others fixed).",
      });
      put(S, `B${rp}`, {
        label: `P-value for ${xv.name}`, cell: `${A}${rp}`, answer: p, format: "prob", formula: pFormula(`${A}${rt}`, `${A}${rDf}`, t),
        explain: `${t < 0 ? "t < 0: 2 × T.DIST(t, n − k − 1, TRUE)." : "t > 0: 2 × (1 − T.DIST(t, n − k − 1, TRUE))."} It matches the report's P-value.`,
        traps: [{ value: pTwo(t, n - 2), why: "Used n − 2 degrees of freedom; with k X variables use n − k − 1." }, { value: p / 2, why: "Forgot to double: the test is two-tailed." }],
      });
      put(S, `B${rd}`, {
        label: `Is ${xv.short} significant? H₀: its coefficient is 0 (R or DR)`, cell: `${A}${rd}`, answer: decide(p < alpha), options: DECISIONS,
        formula: `=IF(${A}${rp}<${A}${q + 1},"R","DR")`,
        explain: p < alpha ? `p < α: R. ${xv.short} helps predict ${ctx.ys} even after allowing for the other variables.` : `p ≥ α: DR. Once the other variables are in the model, ${xv.short} adds nothing significant.`,
      });
    });
    const rDrop = r, rChg = r + 1, rWhich = r + 2;
    const shorts = ctx.xs.map((v) => v.short);
    put(S, `B${rDrop}`, {
      label: `Which variable would you drop first? (${shorts.join(" / ")})`, cell: `${A}${rDrop}`, answer: shorts[jd], options: shorts, formula: lit(shorts[jd]),
      explain: `Drop the variable with the largest P-value above α (here ${ctx.xs[jd].short}, p = ${fmt(round(o.p[jd + 1], 4))}), then re-run the regression without it and check again.`,
    });
    put(S, `B${rChg}`, {
      label: "Change in R² from dropping it (after − before)", cell: `${A}${rChg}`, answer: red.r2 - o.r2, formula: `=I${rr + 1}-${R.r2}`, tol: 1e-5,
      explain: "R² can only go down (or stay the same) when a variable is removed: fewer variables never explain more. That is why adjusted R² is used to compare models.",
    });
    const better = red.adj > o.adj ? "Reduced" : "Full";
    put(S, `B${rWhich}`, {
      label: "Which model has the higher adjusted R²? (Full / Reduced)", cell: `${A}${rWhich}`, answer: better, options: ["Full", "Reduced"],
      formula: `=IF(I${rr + 2}>${R.adj},"Reduced","Full")`,
      explain: better === "Reduced"
        ? "Adjusted R² went up after dropping the variable: it was not pulling its weight."
        : "Adjusted R² went down slightly (the dropped variable's |t| was above 1), even though it was not significant: the simpler model is still usually preferred.",
    });
    return {
      tab: "Variable significance", title: "Which variables matter?",
      text: [
        `${ctx.who} ${n} ${ctx.unit}, with ${k} possible explanatory variables, in B${top}:${T.cols[ctx.xs[k - 1].name].c}${T.last}. The Toolpak's Regression report is in H${top}:N${R.bottom}.`,
        `Test each coefficient at the significance in ${A}${q + 1} (one-tail T functions, the sign of t picks the formula), then decide which variable to drop first.`,
        "Write R or DR. Formulas that point at the report, no rounding.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Run the Toolpak Regression on all X columns. Self-check: it matches the report in the sheet.",
        "Delete the column of the variable you chose to drop (in a copy), re-run the Regression on the remaining X columns. Self-check: R Square and Adjusted R Square match the second block in the sheet.",
      ],
    };
  },
};

// ---------- Q: a dummy variable (Fall 2025 Final, Regression sheet) ----------
type DCtx = { who: string; unit: string; cats: [string, string]; y: string; ys: string; x: string; xs: string; gen: (rng: Rng, n: number) => number[]; xd: number; sign: 1 | -1; ymean: number; sigma: number; yd: number };
const DUMMY: DCtx[] = [
  { who: "A wine shop rates the quality of", unit: "wines", cats: ["White", "Red"], y: "Quality (Y)", ys: "quality", x: "Alcohol % (X1)", xs: "alcohol %", gen: U(8.5, 14, 1), xd: 1, sign: 1, ymean: 5.8, sigma: 0.7, yd: 0 },
  { who: "A store records the spend of", unit: "customers", cats: ["Online", "In-store"], y: "Spend ($) (Y)", ys: "spend", x: "Browsing (min) (X1)", xs: "browsing time", gen: U(2, 40, 1), xd: 0, sign: 1, ymean: 60, sigma: 7, yd: 2 },
  { who: "A dealer records the price of", unit: "used cars", cats: ["Automatic", "Manual"], y: "Price ($) (Y)", ys: "price", x: "Mileage (000) (X1)", xs: "mileage", gen: U(10, 120, 1), xd: 0, sign: -1, ymean: 15000, sigma: 1300, yd: 0 },
  { who: "A letting agent records the monthly rent of", unit: "flats", cats: ["Urban", "Rural"], y: "Rent ($) (Y)", ys: "rent", x: "Size (sq ft) (X1)", xs: "size", gen: I(400, 1500), xd: 0, sign: 1, ymean: 1500, sigma: 110, yd: 0 },
];
const dummy: BlockMaker = {
  key: "l21.dummy",
  title: "A dummy variable for a category (Fall 2025 Final)",
  make(rng): Block {
    const ctx = pick(rng, DUMMY);
    const n = int(rng, 16, 22);
    const [cA, cB] = ctx.cats;
    let types: string[] = [];
    do types = Array.from({ length: n }, () => (rng() < 0.5 ? cA : cB)); while (types.filter((t) => t === cA).length < 5 || types.filter((t) => t === cB).length < 5);
    const d = types.map((t) => (t === cA ? 1 : 0));
    const x1 = ctx.gen(rng, n);
    const dSig = rng() < 0.5;
    const y = multiData(rng, [x1, d], ctx.ymean, ctx.sigma, ctx.yd, [true, dSig], [ctx.sign, rng() < 0.5 ? -1 : 1]);
    const o = ols([x1, d], y);
    const alpha = pick(rng, ALPHAS);
    const S = new Sheet();
    const top = TOP + 1;
    const T = S.table("B", top, ["Obs", "Type", ctx.y, ctx.x, "Dummy (X2)"], types.map((t, i) => [i + 1, t, y[i], x1[i]]));
    const R = writeReport(S, "H", top, [ctx.x, "Dummy (X2)"], o);
    for (let i = 0; i < n; i++) {
      const r = T.first + i;
      put(S, null, {
        label: `Dummy, observation ${i + 1}`, cell: `F${r}`, answer: d[i], tol: 0, formula: `=IF(C${r}="${cA}",1,0)`,
        explain: `The dummy records the category as a number: 1 for ${cA}, 0 for ${cB}.`,
        traps: [{ value: 1 - d[i], why: `Coded it the other way round: the question says 1 for ${cA}.` }],
      });
    }
    const q = Math.max(T.last, R.bottom) + 2;
    const A = "J";
    const x0 = round(Math.min(...x1) + (Math.max(...x1) - Math.min(...x1)) * (0.25 + 0.5 * rng()), ctx.xd);
    S.header(`B${q}`, "Question").header(`${A}${q}`, "Your answer");
    S.label(`B${q + 1}`, `${ctx.x.replace(" (X1)", "")} to predict at`).given(`${A}${q + 1}`, x0);
    S.label(`B${q + 2}`, "alpha").given(`${A}${q + 2}`, alpha);
    const [b0, b1, b2] = o.b;
    const rA = q + 3, rB = q + 4, rDiff = q + 5, rDec = q + 6;
    put(S, `B${rA}`, {
      label: `Predicted ${ctx.ys} for a ${cA} case at that ${ctx.xs}`, cell: `${A}${rA}`, answer: b0 + b1 * x0 + b2,
      formula: `=${R.coef[0]}+${R.coef[1]}*${A}${q + 1}+${R.coef[2]}*1`,
      explain: `${cA} means dummy = 1, so ŷ = b₀ + b₁x₁ + b₂ × 1 (the Fall 2025 Final asked this for a white wine with 7% alcohol).`,
      traps: [{ value: b0 + b1 * x0, why: "Left out the dummy term: for this category the dummy is 1." }],
    });
    put(S, `B${rB}`, {
      label: `Predicted ${ctx.ys} for a ${cB} case at that ${ctx.xs}`, cell: `${A}${rB}`, answer: b0 + b1 * x0,
      formula: `=${R.coef[0]}+${R.coef[1]}*${A}${q + 1}`,
      explain: `${cB} means dummy = 0, so the dummy term drops out: ŷ = b₀ + b₁x₁.`,
      traps: [{ value: b0 + b1 * x0 + b2, why: "Added the dummy coefficient: for this category the dummy is 0." }],
    });
    put(S, `B${rDiff}`, {
      label: `Difference ${cA} − ${cB} at the same ${ctx.xs}`, cell: `${A}${rDiff}`, answer: b2, formula: `=${A}${rA}-${A}${rB}`,
      explain: `The difference is always the dummy's coefficient b₂, whatever the ${ctx.xs}: the two categories get parallel lines.`,
    });
    const rej = o.p[2] < alpha;
    put(S, `B${rDec}`, {
      label: "Is the type significant? H₀: the dummy's coefficient is 0 (R or DR)", cell: `${A}${rDec}`, answer: decide(rej), options: DECISIONS,
      formula: `=IF(${R.pC[2]}<${A}${q + 2},"R","DR")`,
      explain: rej
        ? `The dummy's P-value is below α: R. ${cA} and ${cB} cases with the same ${ctx.xs} differ significantly in ${ctx.ys}.`
        : `The dummy's P-value is not below α: DR. Once ${ctx.xs} is allowed for, the type makes no significant difference (like the wine type in the Fall 2025 data).`,
    });
    return {
      tab: "Dummy variable", title: "Including a dummy variable",
      text: [
        `${ctx.who} ${n} ${ctx.unit} (B${top}:E${T.last}), each of type ${cA} or ${cB}. We include a dummy variable to record the type.`,
        `Complete the Dummy (X2) column F${T.first}:F${T.last}: 1 for ${cA}, 0 for ${cB}. Use =IF(...) and fill down.`,
        `The Toolpak's Regression report of ${ctx.y.replace(" (Y)", "")} on X1 and the dummy is in H${top}:N${R.bottom}. Answer the questions below it with formulas.`,
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Run the Toolpak Regression: Input Y Range = D${top}:D${T.last}, Input X Range = E${top}:F${T.last} (X1 and the dummy side by side), tick Labels. Self-check: it matches the report in the sheet.`,
        "Recode the dummy the other way round (1 for the second type) and re-run. Self-check: the dummy's coefficient changes sign, the intercept changes, but both predictions stay the same.",
      ],
    };
  },
};

// =====================================================================================================

export const LESSON_21: Lesson = {
  n: 21,
  title: "Multiple linear regression",
  unit: 3,
  week: "Week 15 · Mon 7 Dec · Multiple linear regression",
  beta: true,
  sources: [
    "F25_Final.xlsx (Regression sheet: dummy variable, Toolpak multiple regression, prediction)",
    "S26_Final, solutions.xlsx (the Toolpak report layout and how he uses its cells)",
    "Final announcement.docx (Spring 2026: how he examines simple regression)",
    "Textbook: Berenson, Levine, Szabat, Basic Business Statistics, 14th ed., introduction to multiple regression chapter",
  ],
  summary: "Multiple linear regression predicts Y from several X variables at once, ŷ = b₀ + b₁x₁ + … + bₖxₖ, where each coefficient is the effect of its variable holding the others fixed; a 0/1 dummy variable brings a category such as white or red wine into the model. The Toolpak report tells you how much of Y the variables explain together (R², adjusted R², the F test) and which ones matter on their own (t Stat, P-value).",
  defs: [
    { term: "Multiple linear regression model", text: "Y = β₀ + β₁X₁ + β₂X₂ + … + βₖXₖ + ε, estimated by ŷ = b₀ + b₁x₁ + … + bₖxₖ (least squares, as in simple regression). k is the number of X variables.", source: "Anticipated · textbook, introduction to multiple regression" },
    { term: "Running it in the Toolpak", text: "Data Analysis > Regression with Input Y Range = the Y column and Input X Range = all the X columns at once; the X columns must be next to each other. The report has the same three blocks as for simple regression, with one coefficient row per X.", source: "F25 Final › Regression Q2 ('Perform a multiple regression analysis using the Data Toolpak'); X columns side by side: Toolpak requirement" },
    { term: "Prediction", text: "Plug every X value into the fitted equation: ŷ = b₀ + b₁x₁ + b₂x₂ + … . In the Fall 2025 Final: the quality score predicted for a white wine with 7% alcohol. Be wary of values outside the data's range (that sample's alcohol ran from 8.5% to 14%).", source: "F25 Final › Regression Q3; extrapolation: anticipated · textbook" },
    { term: "Interpreting a coefficient", text: "bⱼ is the change in predicted Y for a one-unit increase in Xⱼ, holding all the other X variables fixed (its net effect). It can differ from the slope of a simple regression of Y on Xⱼ alone.", source: "Anticipated · textbook, interpreting the regression coefficients" },
    { term: "Dummy variable", text: "A variable that is 1 for one category and 0 for the other (e.g. 1 = White, 0 = Red), so a category can be used as an X. Its coefficient is the difference in predicted Y between the two categories at the same values of the other X's. Make it with =IF(type=\"White\",1,0).", source: "F25 Final › Regression Q1 (Table 10, 'Dummy (X2)'); interpretation: anticipated · textbook" },
    { term: "R² in multiple regression", text: "R² = Regression SS ÷ Total SS: the proportion of the variation in Y explained by all the X variables together. It never goes down when you add a variable, even a useless one.", source: "Anticipated · textbook (definition as in simple regression)" },
    { term: "Adjusted R²", text: "Adjusted R² = 1 − (1 − R²)(n − 1)/(n − k − 1). It penalises extra variables, so it can go down when a weak variable is added: use it to compare models with different numbers of X's.", source: "Anticipated · textbook, adjusted r²" },
    { term: "Overall F test (Significance F)", text: "H₀: all the slopes are 0 (none of the X's helps). F = MS Regression ÷ MS Residual with k and n − k − 1 df; the Toolpak's Significance F is its p-value. Reject if Significance F < α.", source: "Anticipated · textbook, testing for the significance of the overall model" },
    { term: "t test for each coefficient", text: "H₀: βⱼ = 0 (Xⱼ adds nothing, given the others). t = coefficient ÷ standard error, on n − k − 1 degrees of freedom; the P-value column gives the two-tailed p-value (2*(1-T.DIST(t,df,TRUE)) for t > 0). Same method as his simple-regression test, with n − k − 1 in place of n − 2.", source: "Anticipated · textbook; method as in Spring 2026 Final, solutions › Regression D34, D38" },
    { term: "Dropping insignificant variables", text: "If some P-values are above α, drop the variable with the largest P-value, re-run the regression without it and look again; repeat until every remaining variable is significant. R² never goes up when you drop a variable (it usually falls a little); adjusted R² goes up only if the dropped variable's |t| was below 1.", source: "Anticipated · textbook, model building" },
  ],
  examples: [
    {
      title: "Wine quality, alcohol and a dummy for type (Fall 2025 Final)",
      setup: "Table 10 lists 100 wines (50 white, 50 red) with a quality score out of 10 (Y, E5:E104) and alcohol % (X1, F5:F104). Add a dummy variable for white or red (X2, G5:G104), run a multiple regression with the Toolpak and predict the quality of a white wine with 7% alcohol.",
      table: { head: ["", "Coefficients", "Standard Error", "t Stat", "P-value"], rows: [["Intercept", 0.6765, 0.8800, 0.769, 0.4439], ["Alcohol % (X1)", 0.4652, 0.0820, 5.676, 0.00000014], ["Dummy (X2)", 0.2577, 0.2102, 1.226, 0.2232]] },
      steps: [
        { say: "Dummy in G5, filled down (1 = White, 0 = Red)", formula: "=IF(D5=\"White\",1,0)" },
        { say: "Toolpak Regression: Input Y Range E4:E104, Input X Range F4:G104 (both X columns, side by side), Labels ticked. R Square = 0.2568, Adjusted R Square = 0.2415 (table above)." },
        { say: "Prediction for a white wine (dummy 1) with 7% alcohol, with the output placed at C109 as the question asked (Intercept, X1 and X2 coefficients in D125:D127)", formula: "=D125+D126*7+D127*1", result: "4.1905" },
        { say: "Alcohol: p ≈ 0.00000014 < 0.05, significant. Dummy: p = 0.223 > 0.05, not significant: once alcohol is allowed for, white and red wines don't differ significantly in quality." },
        { say: "Adjusted R² check", formula: "=1-(1-0.2568)*(100-1)/(100-2-1)", result: "0.2415" },
        { say: "Caution: 7% is below every alcohol value in the data (8.5% to 14%), so this prediction is an extrapolation." },
      ],
      takeaway: "A dummy turns a category into a 0/1 column; plug in 1 or 0 when you predict.",
      source: "F25 Final › Regression Q1–Q3 (data and questions are his; no official solution: the regression numbers are ours, checked with numpy)",
    },
    {
      title: "Dropping the dummy",
      setup: "In the wine regression the dummy is not significant. Drop it and re-run with alcohol only.",
      steps: [
        { say: "Largest P-value above α = 0.05: the dummy (0.223). Drop it." },
        { say: "Re-run with X = alcohol only: R Square = 0.2453 (down from 0.2568: R² never goes up when a variable is removed)." },
        { say: "Adjusted R² of the smaller model", formula: "=1-(1-0.2453)*(100-1)/(100-1-1)", result: "0.2376 (slightly below 0.2415: the dummy's |t| = 1.23 was above 1)" },
        { say: "Both models explain about a quarter of the variation in quality; the simpler model with alcohol alone is the one to report, since the dummy is not significant." },
      ],
      takeaway: "Drop the variable with the largest P-value above α and re-run. The decision rests on the P-value, not adjusted R²: here adjusted R² dips slightly, yet the dummy still isn't significant.",
      source: "Our extension of F25 Final › Regression (anticipated: no exam has asked this yet)",
    },
  ],
  quiz: [
    { q: "A house-price regression has the coefficient 12.5 for Size (00 sq ft) alongside Age and Distance. What does 12.5 mean?", options: ["Each extra 100 sq ft adds about 12.5 to predicted price, holding age and distance fixed", "Each extra 100 sq ft adds 12.5 to price whatever happens to age and distance", "Size explains 12.5% of the variation in price", "A house of size 0 is predicted to cost 12.5"], answer: 0, why: "In multiple regression each coefficient is a net effect: the change in predicted Y per unit of that X with the other X's held fixed." },
    { q: "For the Toolpak's multiple regression, how must the X data be laid out?", options: ["All X columns next to each other, entered as one Input X Range", "Each X in a separate Regression run", "The Y column between the X columns", "X columns in any order, anywhere in the sheet"], answer: 0, why: "The Input X Range is one block, so the X columns must sit side by side (in the Fall 2025 Final: Alcohol in F, the dummy in G)." },
    { q: "The dummy is 1 for White and 0 for Red, with coefficient 0.26. A red and a white wine have the same alcohol %. Which is predicted higher, and by how much?", options: ["White, by 0.26", "Red, by 0.26", "White, by 0.26 × the alcohol %", "They are predicted the same"], answer: 0, why: "Only the dummy term differs: white gets + 0.26 × 1, red + 0.26 × 0." },
    { q: "Adding a useless X variable to a regression will…", options: ["raise R² slightly (or leave it), but can lower adjusted R²", "lower R²", "leave both R² and adjusted R² unchanged", "make Significance F equal 1"], answer: 0, why: "R² never falls when you add a variable; adjusted R² = 1 − (1 − R²)(n − 1)/(n − k − 1) penalises the extra k." },
    { q: "A regression has n = 25 observations and k = 3 X variables. How many degrees of freedom do the coefficient t tests use?", options: ["21", "23", "24", "22"], answer: 0, why: "n − k − 1 = 25 − 3 − 1 = 21, the Residual df." },
    { q: "Significance F = 0.0003 with α = 0.05. What does it tell you?", options: ["Reject H₀ that all slopes are 0: the X variables together help predict Y", "Every X variable is significant", "R² = 0.0003", "Don't reject: the model is useless"], answer: 0, why: "Significance F is the p-value of the overall F test. It does not say each variable is significant: check their P-values." },
    { q: "With α = 0.05, the P-values are TV 0.001, Online 0.62, Price 0.08. What should you do first?", options: ["Drop Online, re-run, then look at Price again", "Drop both Online and Price at once", "Drop TV, it has the smallest P-value", "Keep everything, Significance F is small"], answer: 0, why: "Drop the variable with the largest P-value above α, one at a time; Price's P-value may change once Online is gone." },
    { q: "Using n − 2 degrees of freedom for a coefficient's p-value in a regression with 3 X variables would…", options: ["be wrong: use n − k − 1 = n − 4", "be correct, regression always uses n − 2", "be correct only for the intercept", "make no difference at all"], answer: 0, why: "Each extra X costs one degree of freedom; n − 2 is the simple-regression case k = 1." },
  ],
  excel: [
    { fn: "Toolpak > Regression (several X)", use: "Input Y Range = Y column; Input X Range = all X columns at once (adjacent); tick Labels; output to an empty cell. One coefficient row per X." },
    { fn: "IF (dummy variable)", use: "=IF(D5=\"White\",1,0) filled down: 1 for one category, 0 for the other." },
    { fn: "Prediction", use: "=b0 cell + b1 cell*x1 + b2 cell*x2 + …, pointing at the report's Coefficients column." },
    { fn: "Adjusted R²", use: "=1-(1-R²)*(n-1)/(n-k-1), to check the report's Adjusted R Square." },
    { fn: "T.DIST", use: "Coefficient p-values on n − k − 1 df: =2*(1-T.DIST(t,df,TRUE)) for t > 0, =2*T.DIST(t,df,TRUE) for t < 0." },
    { fn: "F statistic", use: "=MS Regression/MS Residual; Significance F is its p-value (read it from the report)." },
  ],
  watch: [
    "BETA: this lesson has not been taught yet (Mon 7 Dec) and there are no notes or solutions for multiple regression. It is anticipated from the Fall 2025 Final and the textbook, and will be replaced by Dr Arathoon's own notes once taught.",
    "Fall 2025 Final, Regression sheet (7 points): Q1 complete a dummy variable column for white/red wine [1]; Q2 run a multiple regression with the Data Toolpak and output it at a given cell [3]; Q3 predict the quality of a white wine with 7% alcohol [3]. The Spring 2026 Final had no multiple regression (that class only reached simple regression).",
    "Expect his simple-regression habits to carry over: answers taken from the report's cells, t = coefficient ÷ standard error, R/DR decisions, one-tail T functions with the sign of t choosing the formula, but with n − k − 1 degrees of freedom.",
    "Common slips: X columns not adjacent for the Toolpak; Y included in the X range; reading Multiple R as R²; leaving out a term (or the intercept) in a prediction; plugging the wrong 0/1 for the dummy; n − 2 df instead of n − k − 1; dropping several insignificant variables at once.",
  ],
  makers: [predict, signif, dummy],
};
