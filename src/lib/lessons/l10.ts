// Lesson 10: continuous probability and the normal distribution (Week 6, Mon 5 Oct).
// Built from "Lesson 10, notes.xlsx" (sheets: Discrete RVs, Independence, Continuous RVs, Normal), the Spring 2026
// Midterm 2 announcement (which lists exactly these topics) and the Spring 2026 Exam 2 solutions.
import { Sheet, int, pick, round, tolFor, TOP, type BlockMaker, type Block, type Part, type Trap } from "./kit.ts";
import type { Lesson } from "./types.ts";

// ---------- local helpers (independent of the site's formula engine) ----------
/** erf by its everywhere-positive series: erf(x) = 2/√π · e^(−x²) · Σ 2ⁿx^(2n+1)/(1·3·…·(2n+1)). */
function erf(x: number): number {
  const ax = Math.abs(x);
  if (ax > 6) return Math.sign(x);
  let term = ax, sum = ax;
  for (let n = 1; n < 1000; n++) { term *= (2 * ax * ax) / (2 * n + 1); sum += term; if (term < 1e-17 * sum) break; }
  return (Math.sign(x) * 2 / Math.sqrt(Math.PI)) * Math.exp(-ax * ax) * sum;
}
const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
const phi = (z: number) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
/** Inverse standard normal: Acklam's rational start, polished with Newton steps on Phi. */
function PhiInv(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  let x: number;
  if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else { const q = p - 0.5, r = q * q; x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  for (let k = 0; k < 3; k++) x -= (Phi(x) - p) / phi(x);
  return x;
}
const ncdf = (x: number, mu: number, sd: number) => Phi((x - mu) / sd);
const npdf = (x: number, mu: number, sd: number) => phi((x - mu) / sd) / sd;
const ninv = (p: number, mu: number, sd: number) => mu + sd * PhiInv(p);
/** Drop traps that would sit on top of the right answer (the checker refuses those). */
function safe(p: Part): Part {
  const tol = tolFor(p);
  const ans = Number(p.answer);
  const traps = (p.traps ?? []).filter((t: Trap) => Number.isFinite(t.value) && Math.abs(t.value - ans) > tol * 2);
  return { ...p, traps: traps.length ? traps : undefined };
}
const ask = (S: Sheet, labelAt: string, p: Part) => S.ask(labelAt, safe(p));
const push = (S: Sheet, p: Part) => { S.parts.push(safe(p)); };
const fmtN = (x: number) => String(Number(x.toFixed(4)));

// ---------- Q1: simulate a die 1000 times (Discrete RVs sheet) ----------
const diceSim: BlockMaker = {
  key: "l10.dice-sim",
  title: "A die rolled 1000 times: E[X], Var[X], frequency table, sample mean and sample variance",
  make(rng): Block {
    const k = pick(rng, [4, 6, 8, 10]);
    const N = 1000;
    const rolls = Array.from({ length: N }, () => int(rng, 1, k));
    const S = new Sheet();
    const sim = S.table("B", TOP, ["Trial", "Outcome"], rolls.map((r, i) => [i + 1, r]));
    const r1 = sim.first, rN = sim.last;
    const data = `C${r1}:C${rN}`;
    // Table 1: the probability distribution (values and probabilities given, (x − E[X])² to fill).
    S.header(`E${TOP}`, "value (x)").header(`F${TOP}`, "Pr(X=x)").header(`G${TOP}`, "(x−E[X])²");
    const t1 = TOP + 1, tk = TOP + k;
    const EX = (k + 1) / 2;
    const VX = (k * k - 1) / 12;
    for (let x = 1; x <= k; x++) {
      const r = TOP + x;
      S.set(`E${r}`, x, "data").set(`F${r}`, 1 / k, "data");
      push(S, {
        label: `(x−E[X])² for x = ${x}`, cell: `G${r}`, answer: (x - EX) ** 2, formula: `=(E${r}-$J$${TOP + 1})^2`,
        explain: "Each value's squared distance from the expectation, with $ on the E[X] cell so it copies down.", tol: 1e-6,
      });
    }
    S.header(`I${TOP}`, "Measure").header(`J${TOP}`, "Your answer");
    ask(S, `I${TOP + 1}`, {
      label: "Expectation E[X]", cell: `J${TOP + 1}`, answer: EX, formula: `=SUMPRODUCT(E${t1}:E${tk},F${t1}:F${tk})`,
      explain: "E[X] = Σ x·Pr(X=x): SUMPRODUCT of the values and their probabilities.",
      traps: [{ value: (k * (k + 1)) / 2, why: "Added the values but forgot to multiply by their probabilities." }],
    });
    ask(S, `I${TOP + 2}`, {
      label: "Variance Var[X]", cell: `J${TOP + 2}`, answer: VX, formula: `=SUMPRODUCT(G${t1}:G${tk},F${t1}:F${tk})`,
      explain: "Var[X] = Σ (x − E[X])²·Pr(X=x): SUMPRODUCT of the (x − E[X])² column and the probabilities.",
      traps: [{ value: (k * (k * k - 1)) / 12, why: "Added the (x − E[X])² column without weighting by the probabilities." }],
    });
    ask(S, `I${TOP + 3}`, {
      label: "Standard deviation of X", cell: `J${TOP + 3}`, answer: Math.sqrt(VX), formula: `=SQRT(J${TOP + 2})`,
      explain: "The standard deviation is the square root of the variance.",
      traps: [{ value: VX, why: "Gave the variance: take its square root." }],
    });
    // Frequency table of the simulated rolls.
    const f0 = TOP + k + 3;
    S.header(`E${f0}`, "Values").header(`F${f0}`, "Freq");
    for (let x = 1; x <= k; x++) {
      const r = f0 + x;
      S.set(`E${r}`, x, "data");
      const cnt = rolls.filter((v) => v === x).length;
      push(S, {
        label: `Frequency of ${x}`, cell: `F${r}`, answer: cnt, tol: 0, formula: `=COUNTIF($C$${r1}:$C$${rN},E${r})`,
        explain: "COUNTIF counts how many simulated rolls equal this value; lock the data range with $ before copying down.",
      });
    }
    const mean = rolls.reduce((s, v) => s + v, 0) / N;
    const varS = rolls.reduce((s, v) => s + (v - mean) ** 2, 0) / (N - 1);
    ask(S, `I${TOP + 5}`, {
      label: "Sample mean of the 1000 rolls", cell: `J${TOP + 5}`, answer: mean, tol: 1e-4, formula: `=AVERAGE(${data})`,
      explain: "The sample mean X̄ is AVERAGE of the simulated values. It should be close to E[X] but not exactly equal.",
      traps: [{ value: EX, why: "Typed E[X]; the question asks for the mean of these 1000 simulated rolls." }],
    });
    ask(S, `I${TOP + 6}`, {
      label: "Sample variance of the 1000 rolls", cell: `J${TOP + 6}`, answer: varS, tol: Math.max(1e-6, varS * 2e-4), formula: `=VAR.S(${data})`,
      explain: "The sample variance divides by n − 1: VAR.S. Compare it with Var[X].",
      traps: [{ value: (varS * (N - 1)) / N, why: "Used VAR.P; a simulated sample uses VAR.S (divide by n − 1)." }, { value: VX, why: "Typed Var[X]; the question asks for the variance of the simulated rolls." }],
    });
    return {
      tab: `Die simulation (${k} sides)`,
      title: `Simulate a ${k}-sided die 1000 times`,
      text: [
        `X is the result of rolling a fair ${k}-sided die (faces 1 to ${k}). Column C holds 1000 simulated rolls.`,
        "Complete the (x−E[X])² column, then find E[X], Var[X] and the standard deviation in column J.",
        "Make the frequency table with COUNTIF, then find the sample mean and sample variance of the 1000 rolls.",
        "Compare: the sample mean and variance should be close to E[X] and Var[X], but not equal.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Make your own 1000 rolls: Data > Data Analysis > Random Number Generation, Distribution "Discrete", with the value and probability input range E${t1}:F${tk}. Self-check: your frequencies are each near ${N / k}, and they add up to 1000.`,
        "Insert a column chart of your frequency table. Self-check: the bars are roughly the same height (a uniform shape).",
      ],
    };
  },
};

// ---------- Q2: independence from a table of counts (Independence sheet) ----------
type IndCtx = { what: string; rowHead: string; rows: [string, string]; cols: [string, string, string] };
const IND: IndCtx[] = [
  { what: "A café records each customer's loyalty status and what they ordered.", rowHead: "Customer", rows: ["Member", "Not a member"], cols: ["Coffee", "Tea", "Smoothie"] },
  { what: "A social media company records each viewer's gender and the type of short video they were shown.", rowHead: "Viewer", rows: ["Man", "Woman"], cols: ["Gym", "Podcast", "Pets"] },
  { what: "A gym records whether each visitor is a student and the time of day they came.", rowHead: "Visitor", rows: ["Student", "Not a student"], cols: ["Morning", "Afternoon", "Evening"] },
  { what: "A bank records whether each customer has a credit card and their age group.", rowHead: "Customer", rows: ["Credit card", "No credit card"], cols: ["Under 30", "30 to 50", "Over 50"] },
  { what: "A cinema records whether each ticket was bought online and the type of film.", rowHead: "Ticket", rows: ["Online", "At the desk"], cols: ["Action", "Comedy", "Drama"] },
];
const independence: BlockMaker = {
  key: "l10.independence",
  title: "Independent or not? Pr(A and B) against Pr(A)Pr(B) from a table of counts",
  make(rng): Block {
    const ctx = pick(rng, IND);
    let a1 = 0, a2 = 0, a3 = 0, b1 = 0, b2 = 0, b3 = 0, N = 0, indB = false, indC = false;
    for (let tries = 0; tries < 200; tries++) {
      N = 400 * pick(rng, [1, 2, 3]);
      const pa = pick(rng, [0.25, 0.3, 0.4, 0.5, 0.6]);
      const pb = pick(rng, [0.2, 0.25, 0.3, 0.4, 0.5]);
      const pc = pick(rng, [0.2, 0.25, 0.3, 0.35]);
      const r = Math.round(N * pa), s = Math.round(N * pb), t = Math.round(N * pc);
      indB = rng() < 0.5; indC = rng() < 0.5;
      const shift = () => (rng() < 0.5 ? -1 : 1) * int(rng, 4, 15) * (N / 400);
      a1 = Math.round((r * s) / N) + (indB ? 0 : shift());
      a2 = Math.round((r * t) / N) + (indC ? 0 : shift());
      a3 = r - a1 - a2;
      b1 = s - a1; b2 = t - a2; b3 = N - r - b1 - b2;
      if ([a1, a2, a3, b1, b2, b3].every((v) => v >= 5) && s + t < N - 20) break;
    }
    const S = new Sheet();
    S.table("B", TOP, [ctx.rowHead, ...ctx.cols], [[ctx.rows[0], a1, a2, a3], [ctx.rows[1], b1, b2, b3]]);
    const R = TOP + 1, R2 = TOP + 2; // the two count rows
    const all = `C${R}:E${R2}`;
    const A = ctx.rows[0], B = ctx.cols[0], C = ctx.cols[1];
    const rA = a1 + a2 + a3, sB = a1 + b1, sC = a2 + b2;
    const pA = rA / N, pB = sB / N, pAB = a1 / N, pC = sC / N, pAC = a2 / N;
    const q = TOP + 5; // first question row
    S.header(`B${q - 1}`, "Question").header(`D${q - 1}`, "Your answer");
    S.text(`B${TOP + 3}`, `Events: A = "${A}", B = "${B}", C = "${C}".`);
    ask(S, `B${q}`, {
      label: `Pr(A) = Pr(${A})`, cell: `D${q}`, answer: pA, format: "prob", formula: `=SUM(C${R}:E${R})/SUM(${all})`,
      explain: "Empirical probability: the row total for A divided by the grand total.",
    });
    ask(S, `B${q + 1}`, {
      label: `Pr(B) = Pr(${B})`, cell: `D${q + 1}`, answer: pB, format: "prob", formula: `=SUM(C${R}:C${R2})/SUM(${all})`,
      explain: "The column total for B divided by the grand total.",
    });
    ask(S, `B${q + 2}`, {
      label: "Pr(A and B)", cell: `D${q + 2}`, answer: pAB, format: "prob", formula: `=C${R}/SUM(${all})`,
      explain: "The one cell that is in both A and B, divided by the grand total.",
      traps: [{ value: pA * pB, why: "Multiplied Pr(A)Pr(B): that is only Pr(A and B) if the events are independent, which is what you are testing." }],
    });
    ask(S, `B${q + 3}`, {
      label: "Pr(A given B)", cell: `D${q + 3}`, answer: a1 / sB, format: "prob", formula: `=C${R}/SUM(C${R}:C${R2})`,
      explain: "Pr(A given B) = Pr(A and B)/Pr(B): inside column B only, the share that is in A.",
      traps: [{ value: a1 / rA, why: "Divided by the A row total: that is Pr(B given A)." }, { value: pAB, why: "Divided by the grand total: that is Pr(A and B)." }],
    });
    ask(S, `B${q + 4}`, {
      label: "Pr(A or B)", cell: `D${q + 4}`, answer: pA + pB - pAB, format: "prob", formula: `=D${q}+D${q + 1}-D${q + 2}`,
      explain: "Pr(A or B) = Pr(A) + Pr(B) − Pr(A and B): subtract the overlap so it isn't counted twice.",
      traps: [{ value: pA + pB, why: "Added Pr(A) and Pr(B) without subtracting Pr(A and B)." }],
    });
    const yes = "Independent", no = "Not independent";
    ask(S, `B${q + 5}`, {
      label: "Are A and B independent?", cell: `D${q + 5}`, answer: indB ? yes : no, options: [yes, no],
      formula: `=IF(ROUND(D${q + 2},9)=ROUND(D${q}*D${q + 1},9),"${yes}","${no}")`,
      explain: `Independent means Pr(A and B) = Pr(A)Pr(B) (equivalently Pr(A given B) = Pr(A)). Here ${fmtN(pAB)} ${indB ? "=" : "≠"} ${fmtN(pA)} × ${fmtN(pB)} = ${fmtN(pA * pB)}.`,
    });
    ask(S, `B${q + 6}`, {
      label: `Pr(C) = Pr(${C})`, cell: `D${q + 6}`, answer: pC, format: "prob", formula: `=SUM(D${R}:D${R2})/SUM(${all})`,
      explain: "The column total for C divided by the grand total.",
    });
    ask(S, `B${q + 7}`, {
      label: "Pr(A and C)", cell: `D${q + 7}`, answer: pAC, format: "prob", formula: `=D${R}/SUM(${all})`,
      explain: "The cell in row A and column C, divided by the grand total.",
      traps: [{ value: pA * pC, why: "Multiplied Pr(A)Pr(C) instead of reading the table." }],
    });
    ask(S, `B${q + 8}`, {
      label: "Are A and C independent?", cell: `D${q + 8}`, answer: indC ? yes : no, options: [yes, no],
      formula: `=IF(ROUND(D${q + 7},9)=ROUND(D${q}*D${q + 6},9),"${yes}","${no}")`,
      explain: `Compare Pr(A and C) with Pr(A)Pr(C): ${fmtN(pAC)} ${indC ? "=" : "≠"} ${fmtN(pA)} × ${fmtN(pC)} = ${fmtN(pA * pC)}.`,
    });
    return {
      tab: "Independence", title: "Are the events independent?",
      text: [
        `${ctx.what} The table shows the counts for ${N} people.`,
        "Use the empirical probabilities implied by the table. Give exact values with formulas (no rounding).",
        "Definition: events A and B are independent if Pr(A given B) = Pr(A); equivalently Pr(A and B) = Pr(A)Pr(B).",
      ],
      cells: S.cells, parts: S.parts,
      manual: ["Draw a Venn diagram of A and B with the counts in each region. Self-check: the four regions add up to the grand total."],
    };
  },
};

// ---------- Q3: continuous random variables made of rectangles and triangles ----------
const continuous: BlockMaker = {
  key: "l10.continuous",
  title: "Continuous random variables: uniform and piecewise-linear densities, probabilities as areas",
  make(rng): Block {
    const shape = pick(rng, ["uniform", "vee", "peak", "flat-then-down"] as const);
    const S = new Sheet();
    S.header(`B${TOP}`, "Given").header(`C${TOP}`, "Value");
    const q = TOP + 6;
    S.header(`B${q - 1}`, "Question").header(`C${q - 1}`, "Your answer");
    const H = `C${q}`; // the height answer cell, used by later parts
    let text: string[] = [];
    if (shape === "uniform") {
      const ctx = pick(rng, [
        { s: "The time it takes a pizza to be delivered", u: "minutes" },
        { s: "The waiting time for a lift", u: "seconds" },
        { s: "The length of a phone call to a help line", u: "minutes" },
      ]);
      const a = pick(rng, [0, 10, 15, 20, 30]);
      const w = pick(rng, [20, 30, 40, 50, 60]);
      const b = a + w;
      const c = a + 5 * int(rng, 1, w / 10);
      const d = c + 5 * int(rng, 1, (b - c) / 5 - 1);
      const h = 1 / w;
      S.label(`B${TOP + 1}`, "Lowest value a").given(`C${TOP + 1}`, a);
      S.label(`B${TOP + 2}`, "Highest value b").given(`C${TOP + 2}`, b);
      S.label(`B${TOP + 3}`, "c").given(`C${TOP + 3}`, c);
      S.label(`B${TOP + 4}`, "d").given(`C${TOP + 4}`, d);
      ask(S, `B${q}`, {
        label: "The height of the density p(x) between a and b", cell: H, answer: h, tol: 1e-7, formula: `=1/(C${TOP + 2}-C${TOP + 1})`,
        explain: "The total area must be 1. A rectangle of width b − a has area 1 when its height is 1/(b − a).",
        traps: [{ value: 1 / b, why: "Used 1/b; the width of the rectangle is b − a." }],
      });
      ask(S, `B${q + 1}`, {
        label: `Pr(X = ${c})`, cell: `C${q + 1}`, answer: 0, format: "prob", formula: "=0",
        explain: "For a continuous random variable the probability of any single exact value is 0 (the area of a line is 0).",
        traps: [{ value: h, why: "That is the height of the density, not a probability: Pr(X = c) is an area of width 0." }],
      });
      ask(S, `B${q + 2}`, {
        label: `Pr(X < ${c})`, cell: `C${q + 2}`, answer: (c - a) * h, format: "prob", formula: `=(C${TOP + 3}-C${TOP + 1})*${H}`,
        explain: "Area of the rectangle from a to c: width (c − a) times height.",
        traps: [{ value: c * h, why: "Measured the width from 0 instead of from a." }],
      });
      ask(S, `B${q + 3}`, {
        label: `Pr(${c} < X < ${d})`, cell: `C${q + 3}`, answer: (d - c) * h, format: "prob", formula: `=(C${TOP + 4}-C${TOP + 3})*${H}`,
        explain: "Area of the rectangle from c to d: (d − c) times the height.",
      });
      ask(S, `B${q + 4}`, {
        label: `Pr(X > ${d})`, cell: `C${q + 4}`, answer: (b - d) * h, format: "prob", formula: `=(C${TOP + 2}-C${TOP + 4})*${H}`,
        explain: "Area from d up to b: (b − d) times the height (or 1 minus the area below d).",
        traps: [{ value: (d - a) * h, why: "Found Pr(X < d) instead of Pr(X > d)." }],
      });
      text = [
        `${ctx.s} is a continuous random variable X, uniformly distributed between ${a} and ${b} ${ctx.u}.`,
        "Uniform means the density p(x) is the same height everywhere between a and b (and 0 outside).",
        "Pr(c < X < d) is the area under the graph of p(x) between c and d. Use formulas that point at the givens.",
      ];
    } else {
      const L = pick(rng, [20, 40, 60, 100, 120]);
      const m = L * pick(rng, [0.25, 0.4, 0.5, 0.6, 0.75]);
      S.label(`B${TOP + 1}`, "Sample space ends at L").given(`C${TOP + 1}`, L);
      S.label(`B${TOP + 2}`, "Where the lines meet, m").given(`C${TOP + 2}`, m);
      const cL = `C${TOP + 1}`, cm = `C${TOP + 2}`, cc = `C${TOP + 3}`, cd = `C${TOP + 4}`;
      const ctx = pick(rng, [
        "the number of minutes into a lecture at which a student first checks their phone",
        "the time (in minutes) a customer spends browsing a website",
        "the distance (in km) a delivery van drives before its first stop",
      ]);
      if (shape === "vee") {
        // p(0) = p(L), p(m) = 0, straight lines: two triangles each of height h. Area = hL/2 = 1.
        const h = 2 / L;
        const c = round(m * pick(rng, [0.5, 0.6, 0.8]), 1);
        S.label(`B${TOP + 3}`, "c").given(cc, c);
        ask(S, `B${q}`, {
          label: "p(0)", cell: H, answer: h, tol: 1e-7, formula: `=1/(0.5*${cm}+0.5*(${cL}-${cm}))`,
          explain: "The graph is two triangles, both with height p(0): ½·m·p(0) + ½·(L − m)·p(0) = 1, so p(0) = 2/L.",
          traps: [{ value: 1 / L, why: "Treated it as uniform (1/L). The shape is two triangles, so the height is twice that." }],
        });
        ask(S, `B${q + 1}`, {
          label: `Pr(X > ${m})`, cell: `C${q + 1}`, answer: 0.5 * (L - m) * h, format: "prob", formula: `=0.5*(${cL}-${cm})*${H}`,
          explain: "The right-hand triangle: ½ × base (L − m) × height p(L) = p(0).",
          traps: [{ value: (L - m) * h, why: "Forgot the ½ in the area of a triangle." }],
        });
        const pc = (h * (m - c)) / m;
        ask(S, `B${q + 2}`, {
          label: `Pr(X < ${c})`, cell: `C${q + 2}`, answer: 0.5 * m * h - 0.5 * (m - c) * pc, format: "prob",
          formula: `=0.5*${cm}*${H}-0.5*(${cm}-${cc})*(${H}*(${cm}-${cc})/${cm})`,
          explain: "The whole left triangle Pr(X < m) minus the small triangle from c to m, whose height at c is p(0)·(m − c)/m (the way the Spring 2026 solution does it).",
          traps: [{ value: 0.5 * (m - c) * pc, why: "Gave the small triangle from c to m; subtract it from the big triangle instead." }, { value: 0.5 * c * pc, why: "Used a triangle from 0 to c, but the region from 0 to c is a trapezium (the line starts high at x = 0)." }],
        });
        text = [
          `X is ${ctx}. Its sample space is all numbers from 0 to ${L}. The density p(x) has p(0) = p(${L}), p(${m}) = 0,`,
          `and the graph of p is a straight line from x = 0 to x = ${m}, and a different straight line from x = ${m} to x = ${L}.`,
          "Sketch the graph first: it is made of triangles. The total area under p(x) is 1, and probabilities are areas.",
        ];
      } else if (shape === "peak") {
        // p(0) = 0, rises to a peak at m, falls to 0 at L: one triangle of height h, area hL/2 = 1.
        const h = 2 / L;
        const c = round(m * pick(rng, [0.4, 0.5, 0.6]), 1);
        const d = round(m + (L - m) * pick(rng, [0.4, 0.5, 0.6]), 1);
        S.label(`B${TOP + 3}`, "c").given(cc, c);
        S.label(`B${TOP + 4}`, "d").given(cd, d);
        ask(S, `B${q}`, {
          label: `p(${m}), the height of the peak`, cell: H, answer: h, tol: 1e-7, formula: `=1/(0.5*${cL})`,
          explain: "The graph is one triangle with base L: ½·L·p(m) = 1, so p(m) = 2/L.",
          traps: [{ value: 1 / L, why: "Forgot the ½ in the triangle's area." }],
        });
        ask(S, `B${q + 1}`, {
          label: `Pr(X < ${m})`, cell: `C${q + 1}`, answer: 0.5 * m * h, format: "prob", formula: `=0.5*${cm}*${H}`,
          explain: "The left part is a triangle: ½ × base m × height p(m).",
          traps: [{ value: m * h, why: "Forgot the ½ in the area of a triangle." }],
        });
        ask(S, `B${q + 2}`, {
          label: `Pr(X < ${c})`, cell: `C${q + 2}`, answer: 0.5 * c * ((h * c) / m), format: "prob", formula: `=0.5*${cc}*(${H}*${cc}/${cm})`,
          explain: "A smaller triangle from 0 to c. Its height at c is p(m)·c/m (the line rises evenly from 0 to the peak).",
          traps: [{ value: 0.5 * c * h, why: "Used the peak height for the small triangle; its height at c is only p(m)·c/m." }],
        });
        ask(S, `B${q + 3}`, {
          label: `Pr(X > ${d})`, cell: `C${q + 3}`, answer: 0.5 * (L - d) * ((h * (L - d)) / (L - m)), format: "prob",
          formula: `=0.5*(${cL}-${cd})*(${H}*(${cL}-${cd})/(${cL}-${cm}))`,
          explain: "A triangle from d to L. Its height at d is p(m)·(L − d)/(L − m) (the line falls evenly from the peak to 0).",
          traps: [{ value: 0.5 * (L - d) * h, why: "Used the peak height; the height at d is p(m)·(L − d)/(L − m)." }],
        });
        text = [
          `X is ${ctx}. Its sample space is all numbers from 0 to ${L}. The density p(x) has p(0) = 0 and p(${L}) = 0,`,
          `and the graph of p is a straight line up from x = 0 to a peak at x = ${m}, then a straight line down to x = ${L}.`,
          "Sketch the graph first: it is one triangle. The total area under p(x) is 1, and probabilities are areas.",
        ];
      } else {
        // flat at height h from 0 to m, then a straight line down to 0 at L: rectangle + triangle, area h(m + (L − m)/2) = 1.
        const h = 1 / (m + 0.5 * (L - m));
        const c = round(m * pick(rng, [0.4, 0.5, 0.6]), 1);
        const d = round(m + (L - m) * pick(rng, [0.4, 0.5, 0.6]), 1);
        S.label(`B${TOP + 3}`, "c").given(cc, c);
        S.label(`B${TOP + 4}`, "d").given(cd, d);
        ask(S, `B${q}`, {
          label: "p(0), the height of the flat part", cell: H, answer: h, tol: 1e-7, formula: `=1/(${cm}+0.5*(${cL}-${cm}))`,
          explain: "Rectangle (width m) plus triangle (base L − m), both of height p(0): p(0)·m + ½·(L − m)·p(0) = 1.",
          traps: [{ value: 1 / L, why: "Treated it as uniform (1/L), but the right-hand part is a triangle, not a rectangle." }],
        });
        ask(S, `B${q + 1}`, {
          label: `Pr(X < ${m})`, cell: `C${q + 1}`, answer: m * h, format: "prob", formula: `=${cm}*${H}`,
          explain: "The rectangle from 0 to m: width × height.",
        });
        ask(S, `B${q + 2}`, {
          label: `Pr(X < ${c})`, cell: `C${q + 2}`, answer: c * h, format: "prob", formula: `=${cc}*${H}`,
          explain: "Still inside the flat part, so it is a rectangle: c × p(0).",
        });
        ask(S, `B${q + 3}`, {
          label: `Pr(X > ${d})`, cell: `C${q + 3}`, answer: 0.5 * (L - d) * ((h * (L - d)) / (L - m)), format: "prob",
          formula: `=0.5*(${cL}-${cd})*(${H}*(${cL}-${cd})/(${cL}-${cm}))`,
          explain: "A triangle from d to L. Its height at d is p(0)·(L − d)/(L − m), because the line falls evenly from p(0) at m to 0 at L.",
          traps: [{ value: 0.5 * (L - d) * h, why: "Used the full height p(0); the height at d is only p(0)·(L − d)/(L − m)." }],
        });
        text = [
          `X is ${ctx}. Its sample space is all numbers from 0 to ${L}. The density p(x) is flat (constant) from x = 0 to x = ${m},`,
          `and then a straight line down from that height at x = ${m} to p(${L}) = 0.`,
          "Sketch the graph first: a rectangle and a triangle. The total area under p(x) is 1, and probabilities are areas.",
        ];
      }
    }
    return {
      tab: "Continuous RV", title: "Probabilities as areas under a density", text,
      cells: S.cells, parts: S.parts,
      manual: ["Draw the density on paper (or as an XY scatter with straight lines in Excel) and shade each area you found. Self-check: the shaded areas for Pr(X < a) and Pr(X > a) add up to 1."],
    };
  },
};

// ---------- Q4: the normal distribution ----------
type NormCtx = { s: string; u: string; mu: number; sd: number; dp: number };
const NORMS: NormCtx[] = [
  { s: "The height of an adult man", u: "cm", mu: 176, sd: 8, dp: 0 },
  { s: "The amount of beer poured into a pint glass", u: "ml", mu: 568, sd: 12, dp: 0 },
  { s: "An SAT score", u: "points", mu: 500, sd: 100, dp: 0 },
  { s: "The life of a light bulb", u: "days", mu: 950, sd: 15, dp: 0 },
  { s: "The amount a customer spends at a supermarket", u: "$", mu: 450, sd: 175, dp: 0 },
  { s: "The length of a short video", u: "seconds", mu: 30, sd: 10, dp: 0 },
  { s: "The height of a WNBA player", u: "cm", mu: 185, sd: 10, dp: 0 },
  { s: "The number of hours a person sleeps", u: "hours", mu: 7, sd: 1.5, dp: 1 },
];
const normal: BlockMaker = {
  key: "l10.normal",
  title: "The normal distribution: NORM.DIST, NORM.INV, Z-scores and the empirical rule",
  make(rng): Block {
    const ctx = pick(rng, NORMS);
    const { mu, sd } = ctx;
    const val = (z: number) => round(mu + z * sd, ctx.dp);
    const a = val(-pick(rng, [0.5, 0.8, 1, 1.25, 1.5, 2]));
    const b = val(pick(rng, [0.4, 0.5, 0.75, 1, 1.3, 1.8]));
    const c = val(-pick(rng, [0.3, 0.6, 1, 1.4]));
    const d = val(pick(rng, [0.2, 0.7, 1.1, 1.6]));
    const top = pick(rng, [0.05, 0.1, 0.2, 0.25]);
    const kAbove = pick(rng, [2, 3]);
    const zx = val(pick(rng, [-1.75, -1.2, -0.75, -0.4, 0.6, 1.1, 1.5, 2.2]));
    const kWithin = pick(rng, [1, 2, 3]);
    const S = new Sheet();
    S.header(`B${TOP}`, "Given").header(`C${TOP}`, "Value");
    S.label(`B${TOP + 1}`, "Mean μ").given(`C${TOP + 1}`, mu);
    S.label(`B${TOP + 2}`, "Standard deviation σ").given(`C${TOP + 2}`, sd);
    const M = "$C$" + (TOP + 1), SD = "$C$" + (TOP + 2);
    const q = TOP + 5;
    S.header(`B${q - 1}`, "Question").header(`C${q - 1}`, "x").header(`D${q - 1}`, "Second x").header(`E${q - 1}`, "Your answer");
    const Fa = ncdf(a, mu, sd);
    S.given(`C${q}`, a);
    ask(S, `B${q}`, {
      label: `Pr(X < ${a})`, cell: `E${q}`, answer: Fa, format: "prob", formula: `=NORM.DIST(C${q},${M},${SD},TRUE)`,
      explain: "NORM.DIST(x, mean, std_dev, TRUE) is the probability of being below x.",
      traps: [{ value: 1 - Fa, why: "Found Pr(X > x); 'less than' is NORM.DIST itself." }, { value: npdf(a, mu, sd), why: "Used FALSE as the last argument: that gives the height of the curve, not a probability. Use TRUE." }],
    });
    const Fb = ncdf(b, mu, sd);
    S.given(`C${q + 1}`, b);
    ask(S, `B${q + 1}`, {
      label: `Pr(X > ${b})`, cell: `E${q + 1}`, answer: 1 - Fb, format: "prob", formula: `=1-NORM.DIST(C${q + 1},${M},${SD},TRUE)`,
      explain: "NORM.DIST gives the area to the left; the area to the right is 1 minus it.",
      traps: [{ value: Fb, why: "Forgot the 1 −: NORM.DIST alone is Pr(X < x)." }],
    });
    const Fc = ncdf(c, mu, sd), Fd = ncdf(d, mu, sd);
    S.given(`C${q + 2}`, c).given(`D${q + 2}`, d);
    ask(S, `B${q + 2}`, {
      label: `Pr(${c} < X < ${d})`, cell: `E${q + 2}`, answer: Fd - Fc, format: "prob",
      formula: `=NORM.DIST(D${q + 2},${M},${SD},TRUE)-NORM.DIST(C${q + 2},${M},${SD},TRUE)`,
      explain: "Area below the upper value minus the area below the lower value.",
      traps: [{ value: Fd, why: "Only found Pr(X < upper value); subtract Pr(X < lower value)." }, { value: Fc - Fd, why: "Subtracted the wrong way round (a probability can't be negative)." }],
    });
    S.given(`C${q + 3}`, top, true);
    ask(S, `B${q + 3}`, {
      label: `How large must X be to be in the top ${Math.round(top * 100)}%?`, cell: `E${q + 3}`, answer: ninv(1 - top, mu, sd),
      formula: `=NORM.INV(1-C${q + 3},${M},${SD})`,
      explain: `The top ${Math.round(top * 100)}% starts where ${Math.round((1 - top) * 100)}% of values are below: NORM.INV(1 − ${top}, mean, std_dev).`,
      traps: [{ value: ninv(top, mu, sd), why: "Used NORM.INV(q): that is the value with q below it (the bottom q%). The top q% needs 1 − q." }],
    });
    S.given(`C${q + 4}`, kAbove);
    ask(S, `B${q + 4}`, {
      label: `How large must X be to be at least ${kAbove} standard deviations above the mean?`, cell: `E${q + 4}`, answer: mu + kAbove * sd,
      formula: `=${M}+C${q + 4}*${SD}`,
      explain: "No probability is needed: k standard deviations above the mean is μ + kσ (Spring 2026 Exam 2 wrote =176+3*8).",
      traps: [{ value: mu + kAbove * sd * sd, why: "Multiplied by the variance; use the standard deviation σ." }],
    });
    S.given(`C${q + 5}`, zx);
    const z = (zx - mu) / sd;
    ask(S, `B${q + 5}`, {
      label: `The Z-score of ${zx}`, cell: `E${q + 5}`, answer: z, formula: `=(C${q + 5}-${M})/${SD}`, tol: 1e-6,
      explain: "Z = (x − mean)/std_dev: how many standard deviations x is from the mean (negative means below). STANDARDIZE gives the same.",
      traps: [{ value: -z, why: "Subtracted the wrong way round: Z = (x − μ)/σ." }, { value: (zx - mu) / (sd * sd), why: "Divided by the variance; divide by σ." }],
    });
    S.given(`C${q + 6}`, kWithin);
    const within = Phi(kWithin) - Phi(-kWithin);
    ask(S, `B${q + 6}`, {
      label: `Pr(X is within ${kWithin} standard deviation${kWithin > 1 ? "s" : ""} of the mean)`, cell: `E${q + 6}`, answer: within, format: "prob",
      formula: `=NORM.DIST(${M}+C${q + 6}*${SD},${M},${SD},TRUE)-NORM.DIST(${M}-C${q + 6}*${SD},${M},${SD},TRUE)`,
      explain: `Area between μ − ${kWithin}σ and μ + ${kWithin}σ. The empirical rule says about ${["68%", "95%", "99.7%"][kWithin - 1]}; this is the exact value.`,
      traps: [{ value: Phi(kWithin), why: "Only found Pr(X < μ + kσ); subtract Pr(X < μ − kσ)." }],
    });
    return {
      tab: "Normal distribution", title: "Normal probabilities and values",
      text: [
        `${ctx.s} is normally distributed with mean ${mu} ${ctx.u} and standard deviation ${sd} ${ctx.u}.`,
        "Answer each question in column E with a formula that points at the givens (the x values are in columns C and D).",
        "Use NORM.DIST(x, mean, std_dev, TRUE) for probabilities and NORM.INV(probability, mean, std_dev) for values.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [`Use Random Number Generation (Distribution "Normal", mean ${mu}, standard deviation ${sd}) to make 1000 values. Self-check: COUNTIF of values below ${a}, divided by 1000, is close to your Pr(X < ${a}).`],
    };
  },
};

export const LESSON_10: Lesson = {
  n: 10,
  title: "Continuous probability and the normal distribution",
  unit: 1,
  week: "Week 6 · Mon 5 Oct · Continuous probability and the normal distribution",
  sources: ["Lesson 10, notes.xlsx", "Midterm 2 announcement.docx (Spring 2026)", "S26_Exam 2.docx", "S26_Exam2_solutions.xlsx", "Fall_2026_Exam1_solutions.xlsx", "Homework 4, solutions.xlsx", "Exam_2_practice_solutions.xlsx"],
  summary:
    "Lesson 10 finishes discrete random variables by simulating a die 1000 times and comparing the sample with E[X] and Var[X], then defines independent events. It moves on to continuous random variables, where probabilities are areas under a density curve, and ends with the normal distribution and NORM.DIST, which you will use on every exam from here to the final.",
  defs: [
    { term: "Expectation E[X]", text: "E[X] is the SUMPRODUCT of the values and their probabilities (the same as adding up the x·Pr(X=x) column). For a fair die E[X] = 3.5.", source: "Lesson 10, notes › Discrete RVs J4:K5" },
    { term: "Variance and standard deviation of X", text: "Make a (x − E[X])² column; Var[X] is the SUMPRODUCT of that column and the probabilities, and Std dev[X] = SQRT(Var[X]). For a fair die Var[X] = 2.9167 and Std dev[X] = 1.7078.", source: "Lesson 10, notes › Discrete RVs F4, J6:K7" },
    { term: "Simulation and frequency table", text: "Task: simulate a dice roll 1000 times and make a frequency table. Count each value with COUNTIF over the 1000 results; the frequencies add up to 1000.", source: "Lesson 10, notes › Discrete RVs B2, F12:G20" },
    { term: "Sample mean and sample variance", text: "The sample mean X̄ is AVERAGE of the simulated values and the sample variance is VAR.S. His 1000 rolls gave 3.535 and 2.894: close to E[X] = 3.5 and Var[X] = 2.917, but not equal.", source: "Lesson 10, notes › Discrete RVs I12:J13" },
    { term: "Mutually exclusive", text: "For a die, E = the number is even and O = the number is odd: Pr(E and O) = 0, so E and O are mutually exclusive (they share no outcome).", source: "Lesson 10, notes › Independence E4:L9" },
    { term: "Conditional probability", text: "Pr(B given E) = Pr(B and E)/Pr(E). With B = the number is ≥ 4: Pr(B given E) = (2/6)/(1/2) = 2/3, which is not Pr(B) = 1/2, so B and E are dependent.", source: "Lesson 10, notes › Independence E10:O13" },
    { term: "Independent events", text: "Definition: events A and B are independent if Pr(A given B) = Pr(A). Equivalently: Pr(A and B) = Pr(A)Pr(B). Example: flip a coin 3 times; A = the first two are heads (2/8), B = the third flip is a head (4/8); Pr(A and B) = 1/8 = (2/8)(4/8), so they are independent.", source: "Lesson 10, notes › Independence I13:J18, B19:H23" },
    { term: "Single values have probability 0", text: "If X is the position on a 100 cm stick where an arrow lands, every number (all decimal places) is possible: infinitely many. So Pr(X = 50cm) = 0 (but still technically possible).", source: "Lesson 10, notes › Continuous RVs B3:B10" },
    { term: "Continuous random variable", text: "Definition: a continuous random variable X consists of two things: 1. a sample space containing all numbers in some range; 2. a probability density function p(x) for which Pr(a<X<b) = the area under the graph of p(x) between a and b.", source: "Lesson 10, notes › Continuous RVs B16:D20" },
    { term: "Total area 1 and the uniform density", text: "Pr(0<X<100) = 1, so the total area under p(x) is 1. It follows that for the stick p(x) = 1/100 for all x between 0 and 100: the same height everywhere (uniform). So Pr(X ≤ 50) = 0.5, Pr(X ≥ 70) = 0.3, Pr(10 < X < 90) = 0.8.", source: "Lesson 10, notes › Continuous RVs B12:E23" },
    { term: "Piecewise-linear densities (key fact)", text: "For a density made of straight lines (triangles and rectangles): use total area = 1 to find the unknown height, then find probabilities as areas: ½ × base × height for a triangle, width × height for a rectangle. Spring 2026 Exam 2: p(0) = p(100), p(60) = 0 gives p(0) = 1/50 and Pr(X > 60) = ½·40·(1/50) = 0.4.", source: "Midterm 2 announcement (Spring 2026); S26_Exam2_solutions › Continuous D2:E6" },
    { term: "Normal probabilities: NORM.DIST", text: "If X is normal with a given mean and standard deviation, Pr(X < x) = NORM.DIST(x, mean, std_dev, TRUE). Men's heights with mean 176cm and standard deviation 15cm: Pr(height < 180cm) = NORM.DIST(180,176,15,TRUE) = 0.6051.", source: "Lesson 10, notes › Normal B2:H4" },
    { term: "Values from probabilities: NORM.INV (key fact)", text: "To find the value with a given probability below it, use NORM.INV(probability, mean, std_dev). Heights with mean 176 and standard deviation 8: to be in the top 10% you need NORM.INV(0.9,176,8) = 186.25 cm.", source: "Midterm 2 announcement (Spring 2026); S26_Exam2_solutions › Normal E8" },
    { term: "Z-score", text: "Z = (x − mean)/std_dev: how many standard deviations x is from the mean (negative below the mean, 0 at the mean). With mean 176 and standard deviation 8, a 170 cm man has Z = (170 − 176)/8 = −0.75.", source: "S26_Exam2_solutions › Normal F11; Lesson 6, notes › Z-scores" },
    { term: "Empirical rule (key fact)", text: "For a normal distribution about 68% of values lie within 1 standard deviation of the mean, about 95% within 2 and about 99.7% within 3. Exact check: NORM.DIST(μ+σ,μ,σ,TRUE) − NORM.DIST(μ−σ,μ,σ,TRUE) = 0.6827. (Not written in the notes, but listed as examinable.)", source: "Midterm 2 announcement (Spring 2026); F25_Exam1_solutions › Part 3 C43:F47" },
  ],
  examples: [
    {
      title: "A fair die: E[X], Var[X] and 1000 simulated rolls",
      setup: "X is the result of rolling a fair die. Find E[X], Var[X] and the standard deviation. Then simulate a dice roll 1000 times, make a frequency table and compare the sample mean and variance.",
      table: { head: ["x", "Pr(X=x)", "(x−E[X])²", "Frequency in 1000 rolls"], rows: [[1, "1/6", 6.25, 150], [2, "1/6", 2.25, 187], [3, "1/6", 0.25, 152], [4, "1/6", 0.25, 173], [5, "1/6", 2.25, 165], [6, "1/6", 6.25, 173]] },
      steps: [
        { say: "Expectation: SUMPRODUCT of the values (C5:C10) and the probabilities (D5:D10).", formula: "=SUMPRODUCT(C5:C10,D5:D10)", result: "3.5" },
        { say: "Squared distance from E[X] for each value, with $ on the E[X] cell (K4).", formula: "=(C5-$K$4)^2", result: "6.25 (for x = 1)" },
        { say: "Variance: SUMPRODUCT of the (x − E[X])² column and the probabilities.", formula: "=SUMPRODUCT(F5:F10,D5:D10)", result: "2.9167" },
        { say: "Standard deviation: square root of the variance.", formula: "=SQRT(K6)", result: "1.7078" },
        { say: "Frequency table of the 1000 simulated rolls in C12:C1011 (lock the range, copy down).", formula: "=COUNTIF($C$12:$C$1011,F14)", result: "187 (for x = 2); the six counts add up to 1000" },
        { say: "Sample mean of the simulation.", formula: "=AVERAGE(C12:C1011)", result: "3.535 (close to E[X] = 3.5)" },
        { say: "Sample variance of the simulation.", formula: "=VAR.S(C12:C1011)", result: "2.8937 (close to Var[X] = 2.9167)" },
      ],
      takeaway: "A simulation's sample mean and variance estimate E[X] and Var[X]; they are close but not equal.",
      source: "Lesson 10, notes › Discrete RVs",
    },
    {
      title: "Independent or dependent? A die and three coin flips",
      setup: "Roll a die. E = the number is even, O = the number is odd, B = the number is greater than or equal to 4. Then flip a coin 3 times: A = the first two are heads, B = the third flip is a head.",
      steps: [
        { say: "E and O share no outcome.", formula: "Pr(E and O)", result: "0, so mutually exclusive" },
        { say: "B and E share {4, 6}.", formula: "=2/6", result: "Pr(B and E) = 0.3333" },
        { say: "Conditional probability of B given E.", formula: "=(2/6)/(1/2)", result: "2/3 = 0.6667" },
        { say: "Compare with Pr(B) = 3/6 = 1/2: knowing E changes the chance of B.", formula: "=1/2*1/2", result: "Pr(B)Pr(E) = 0.25 ≠ 0.3333, so B and E are dependent" },
        { say: "Coins: 8 equally likely outcomes. Pr(A) = 2/8, Pr(B) = 4/8.", formula: "=(2/8)*(4/8)", result: "0.125 = Pr(A and B) = 1/8, so A and B are independent" },
        { say: "Same conclusion with the first definition.", formula: "Pr(B given A) = (1/8)/(2/8)", result: "1/2 = Pr(B)" },
      ],
      takeaway: "Independent means Pr(A and B) = Pr(A)Pr(B); mutually exclusive (Pr(A and B) = 0) is a different idea.",
      source: "Lesson 10, notes › Independence",
    },
    {
      title: "Continuous random variables: the stick, a two-line density and men's heights",
      setup: "(1) X is the position (cm) on a 100 cm stick where an arrow lands. (2) Spring 2026 Exam 2: X is the percentage of a song someone listens to, on 0 to 100, with p(0) = p(100), p(60) = 0 and straight lines in between. (3) Men's heights are normal with mean 176cm and standard deviation 15cm.",
      steps: [
        { say: "Stick: total area 1 over a width of 100, so the height is constant.", formula: "=1/100", result: "p(x) = 0.01" },
        { say: "Stick: Pr(10 < X < 90) is a rectangle 80 wide.", formula: "=80*(1/100)", result: "0.8" },
        { say: "Song: two triangles of height p(0): ½·60·p(0) + ½·40·p(0) = 50·p(0) = 1.", formula: "=1/50", result: "p(0) = 0.02" },
        { say: "Song: Pr(X > 60) is the right-hand triangle.", formula: "=(1/2)*40*D2", result: "0.4" },
        { say: "Song: Pr(X < 50) = the first triangle (0.6) minus the small triangle from 50 to 60, whose height at 50 is (1/50)·(10/60) = 1/300.", formula: "=0.6-((1/2)*10*(1/(50*6)))", result: "0.5833" },
        { say: "Heights: probability of being shorter than 180cm.", formula: "=NORM.DIST(180,176,15,TRUE)", result: "0.6051" },
      ],
      takeaway: "Continuous probabilities are areas: rectangles and triangles by hand, NORM.DIST for the normal curve.",
      source: "Lesson 10, notes › Continuous RVs, Normal; S26_Exam2_solutions › Continuous",
    },
  ],
  quiz: [
    { q: "X is the position on a 100 cm stick where an arrow lands (any number from 0 to 100 is possible). What is Pr(X = 50cm)?", options: ["0.5", "0.01", "0", "1/50"], answer: 2, why: "For a continuous random variable every single exact value has probability 0 (but is still technically possible). Probabilities come from ranges: Pr(X ≤ 50) = 0.5." },
    { q: "For a continuous random variable with density p(x), what is Pr(a < X < b)?", options: ["p(b) − p(a)", "The area under the graph of p(x) between a and b", "p(b)", "p(a)·p(b)"], answer: 1, why: "That is his definition: the density's job is that areas under it are probabilities." },
    { q: "Which statement is the definition of independent events A and B?", options: ["Pr(A and B) = 0", "Pr(A or B) = Pr(A) + Pr(B)", "Pr(A and B) = Pr(A)Pr(B)", "Pr(A given B) = Pr(B given A)"], answer: 2, why: "A and B are independent if Pr(A given B) = Pr(A), equivalently Pr(A and B) = Pr(A)Pr(B). Pr(A and B) = 0 is mutually exclusive." },
    { q: "Roll a die. E = even, O = odd. Which is true?", options: ["E and O are independent", "E and O are mutually exclusive, so they are not independent", "Pr(E and O) = 1/4", "Pr(E or O) = 1/2"], answer: 1, why: "Pr(E and O) = 0 but Pr(E)Pr(O) = 1/4, so they fail the independence test. Knowing E happened tells you O can't." },
    { q: "Of 400 customers, 120 are members, 160 bought coffee and 48 are members who bought coffee. Are 'member' and 'coffee' independent?", options: ["Yes: 48/400 = (120/400)(160/400) = 0.12", "No: 48 is less than 120", "No: Pr(member and coffee) must be 0", "Can't tell without more data"], answer: 0, why: "Pr(A and B) = 0.12 and Pr(A)Pr(B) = 0.3 × 0.4 = 0.12, so they are independent." },
    { q: "Heights are normal with mean 176cm and standard deviation 15cm. What does =NORM.DIST(180,176,15,TRUE) give?", options: ["Pr(height > 180cm)", "Pr(height < 180cm)", "Pr(height = 180cm)", "The height of the top 18%"], answer: 1, why: "NORM.DIST with TRUE is the area to the left of x: the probability of being below 180cm (0.6051 in his notes)." },
    { q: "Heights are normal with mean 176 and standard deviation 8. Which formula gives how tall a man must be to be in the top 10%?", options: ["=NORM.INV(0.1,176,8)", "=NORM.DIST(0.9,176,8,TRUE)", "=NORM.INV(0.9,176,8)", "=1-NORM.INV(0.1,176,8)"], answer: 2, why: "The top 10% starts where 90% are below, so NORM.INV(0.9, mean, std_dev) = 186.25 cm (Spring 2026 Exam 2)." },
    { q: "Mean 176, standard deviation 8. What is the Z-score of 170?", options: ["0.75", "−0.75", "−6", "−0.09375"], answer: 1, why: "Z = (170 − 176)/8 = −0.75: three quarters of a standard deviation below the mean." },
    { q: "By the empirical rule, roughly what share of a normal distribution lies within 2 standard deviations of the mean?", options: ["68%", "95%", "99.7%", "50%"], answer: 1, why: "About 68% within 1, 95% within 2 and 99.7% within 3 standard deviations (exactly 0.9545 for 2)." },
    { q: "X has sample space 0 to 100, p(0) = p(100), p(60) = 0, with straight lines in between. What is p(0)?", options: ["1/100", "1/50", "1/60", "1/30"], answer: 1, why: "Two triangles of height p(0): ½·60·p(0) + ½·40·p(0) = 50·p(0) = 1, so p(0) = 1/50 (Spring 2026 Exam 2 Q3)." },
  ],
  excel: [
    { fn: "SUMPRODUCT", use: "E[X] = SUMPRODUCT(values, probabilities); Var[X] = SUMPRODUCT((x − E[X])² column, probabilities)." },
    { fn: "SQRT", use: "Standard deviation of X from the variance: =SQRT(K6)." },
    { fn: "COUNTIF", use: "Frequency table of simulated results: =COUNTIF($C$12:$C$1011,F13), with $ on the data range so it copies down." },
    { fn: "AVERAGE / VAR.S", use: "Sample mean and sample variance of the simulated values, to compare with E[X] and Var[X]." },
    { fn: "Random Number Generation (Data Analysis Toolpak)", use: "Data > Data Analysis > Random Number Generation. Discrete (point at a value and probability table), Uniform (between a and b) or Normal (mean, standard deviation). Set the number of random numbers (e.g. 1000)." },
    { fn: "NORM.DIST(x, mean, std_dev, TRUE)", use: "Pr(X < x) for a normal X. Greater than: =1-NORM.DIST(...). Between: NORM.DIST(upper) − NORM.DIST(lower). Always TRUE as the last argument." },
    { fn: "NORM.INV(probability, mean, std_dev)", use: "The value with that probability below it. Top 10%: =NORM.INV(0.9,176,8). Middle 90% around the mean: =NORM.INV(0.95,7,3)-7 for the half-width." },
    { fn: "NORM.S.DIST / NORM.S.INV", use: "The standard normal (mean 0, standard deviation 1), for Z-scores: within one standard deviation is =NORM.S.DIST(1,TRUE)-NORM.S.DIST(-1,TRUE)." },
    { fn: "Z-score: =(x-mean)/std_dev or STANDARDIZE", use: "He writes it out, e.g. =(H11-176)/8. STANDARDIZE(x, mean, std_dev) gives the same number." },
  ],
  watch: [
    "Spring 2026 Exam 2 Q2 (heights normal with mean 176, standard deviation 8): Pr(< 160) = NORM.DIST(160,176,8,TRUE) = 0.0228; Pr(> 180) = 1 − NORM.DIST(180,176,8,TRUE) = 0.3085; 3 standard deviations above the mean = 176+3*8 = 200 (no NORM function needed); top 10% = NORM.INV(0.9,176,8) = 186.25; Z-scores = (x − 176)/8.",
    "Spring 2026 Exam 2 Q2 also used independence: the share of men between 147 and 203 cm = NORM.DIST(203,…) − NORM.DIST(147,…) = 0.99949, and all 10 of 10 random men in range = that number ^10 = 0.9949. 'Keep answer as a percentage': his solution still enters the decimal from NORM.DIST, so format the cell as a percentage rather than typing 99.95.",
    "Spring 2026 Exam 2 Q3 (density on 0–100 made of two straight lines with p(0) = p(100), p(60) = 0): p(0) = 1/50 from total area 1; Pr(X > 60) = 0.4; Pr(X < 50) = 0.6 − ½·10·(1/300) = 0.5833. Sketch the graph before you calculate.",
    "Spring 2026 Exam 2 Q1: card events R (red), F (face), H (value ≥ 10), S (spade) and a table of I/D for every pair. Test each pair with Pr(A and B) against Pr(A)Pr(B) using exact fractions (=12/52). R and S are mutually exclusive (Pr(R and S) = 0), which makes them dependent, not independent.",
    "Fall 2026 Exam 1 Section 3 (Empirical probability) ended with the normal distribution: video length with mean 30 s and standard deviation 10 s, Pr(< 20 s) = NORM.DIST(20,30,10,TRUE) = 0.1587, and 5 independent videos all over 20 s = (1 − 0.1587)^5 = 0.4216.",
    "F25 Exam 1 Q3(i) asked which statements are true for the normal distribution: symmetric about the mean, the empirical rule applies, the mean has Z-score 0 are true; 'the standard deviation is 1' (only the standard normal) and 'negative values are impossible' are false.",
    "Homework 4 asked for the Z-scores of every exam score (sample mean and standard deviation in the Charts sheet), then box plots of the Z-scores: Z = (x − mean)/std_dev, with $ on the mean and standard deviation cells.",
    "Common slips: NORM.DIST needs TRUE (FALSE gives the height of the curve, not a probability); 'greater than' needs 1 − NORM.DIST; 'top q%' needs NORM.INV(1 − q, …); forgetting the ½ in a triangle's area; and rounding. He grades the exact value, so keep fractions as formulas (=1/50, =12/52).",
  ],
  makers: [diceSim, independence, continuous, normal],
};
