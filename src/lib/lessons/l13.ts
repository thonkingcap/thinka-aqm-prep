// Lesson 13: Confidence intervals, part 1 (Week 8, Wed 21 Oct).
// Built from "Lesson 13, notes.xlsx": Normal (the sample mean and its standard error) and
// Confidence interval (the cereal machine: probability for x̄, the 95% range for x̄, significance α).
import { Sheet, pick, round, tolFor, TOP, normals, type Block, type BlockMaker } from "./kit.ts";
import { normDist, normInvGeneral } from "../stats.ts";
import type { Lesson } from "./types.ts";

// ---------- local helpers ----------
function tidy(S: Sheet) {
  for (const p of S.parts) {
    if (!p.traps || p.options) continue;
    const seen: number[] = [];
    p.traps = p.traps.filter((t) => {
      if (!Number.isFinite(t.value)) return false;
      if (Math.abs(t.value - Number(p.answer)) <= 1.6 * tolFor(p)) return false;
      if (seen.some((s) => Math.abs(s - t.value) < 1e-9)) return false;
      seen.push(t.value);
      return true;
    });
  }
}
const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
const pct = (alpha: number) => `${Math.round((1 - alpha) * 100)}%`;
/** "a 95%" / "an 80%". */
const aPct = (alpha: number) => `${Math.round((1 - alpha) * 100) === 80 ? "an" : "a"} ${pct(alpha)}`;
const INOUT = ["Inside", "Outside"];

type Machine = { what: string; unit: string; mu: number; sd: number; d: number };
const MACHINES: Machine[] = [
  { what: "A cereal manufacturer has a machine which dispenses cereal into boxes", unit: "ounces", mu: 11, sd: 0.5, d: 3 },
  { what: "A coffee machine pours drinks", unit: "ml", mu: 250, sd: 6, d: 1 },
  { what: "A factory cuts bolts to length", unit: "mm", mu: 40, sd: 0.8, d: 2 },
  { what: "A bottling line fills juice bottles", unit: "ml", mu: 500, sd: 4, d: 1 },
  { what: "A snack company fills bags of chips", unit: "g", mu: 28, sd: 1.2, d: 2 },
  { what: "A bakery bakes loaves of bread", unit: "g", mu: 800, sd: 12, d: 1 },
];

// ---------- Q1: the cereal machine (his Confidence interval sheet) ----------
const cereal: BlockMaker = {
  key: "l13.cereal",
  title: "Where will the sample mean land? (probability and the 1 − α range)",
  make(rng): Block {
    const m = pick(rng, MACHINES);
    const n = pick(rng, [4, 5, 6, 8, 10]);
    const alpha = pick(rng, [0.2, 0.1, 0.05, 0.01]);
    const se = m.sd / Math.sqrt(n);
    // Most seeds: the machine works. Some: it is off by a few standard errors (so the sample mean lands outside).
    const off = rng() < 0.4 ? pick(rng, [-1, 1]) * pick(rng, [2.6, 3, 3.5]) * se : 0;
    const xs = normals(rng, n, m.mu + off, m.sd, m.d);
    const xbar = avg(xs);
    const diff = Math.abs(xbar - m.mu);
    const a = round(m.mu - pick(rng, [1, 1.5, 2, 2.2]) * se, m.d - 1 > 0 ? m.d - 1 : 1);
    const pA = normDist(a, m.mu, se);
    const left = normInvGeneral(alpha / 2, m.mu, se);
    const right = normInvGeneral(1 - alpha / 2, m.mu, se);
    const inside = xbar >= left && xbar <= right;

    const S = new Sheet();
    const t = S.table("C", TOP, ["Box", m.unit === "ounces" ? "Amount (ounces)" : `Amount (${m.unit})`], xs.map((x, i) => [i + 1, x]));
    const range = t.cols[Object.keys(t.cols)[1]].range;
    const r = (i: number) => TOP + i;
    S.header(`F${r(0)}`, "Given").header(`H${r(0)}`, "Value");
    S.label(`F${r(1)}`, "mean μ (claimed)").given(`H${r(1)}`, m.mu);
    S.label(`F${r(2)}`, "sigma σ").given(`H${r(2)}`, m.sd);
    S.label(`F${r(3)}`, "n (sample size)").given(`H${r(3)}`, n);
    S.label(`F${r(4)}`, "alpha α").given(`H${r(4)}`, alpha);
    S.label(`F${r(5)}`, "value a").given(`H${r(5)}`, a);
    S.header(`J${r(0)}`, "Question").header(`M${r(0)}`, "Your answer");
    S.ask(`J${r(1)}`, {
      label: "Sample mean", cell: `M${r(1)}`, answer: xbar, formula: `=AVERAGE(${range})`,
      explain: "His G11: =AVERAGE of the simulated boxes.",
    });
    S.ask(`J${r(2)}`, {
      label: "Absolute difference between the sample mean and μ", cell: `M${r(2)}`, answer: diff, formula: `=ABS(M${r(1)}-H${r(1)})`,
      explain: "His H13: =ABS(G11-11), how far the sample mean is from the true mean.",
    });
    S.ask(`J${r(3)}`, {
      label: "Standard error", cell: `M${r(3)}`, answer: se, formula: `=H${r(2)}/SQRT(H${r(3)})`,
      explain: "X̄ is normal with mean μ and standard error σ/√n (his J20: =0.5/SQRT(5)).",
      traps: [{ value: m.sd / n, why: "Divided by n instead of √n." }],
    });
    S.ask(`J${r(4)}`, {
      label: "Pr(sample mean < a), if the manufacturer is telling the truth", cell: `M${r(4)}`, answer: pA, format: "prob",
      formula: `=NORM.DIST(H${r(5)},H${r(1)},M${r(3)},TRUE)`,
      explain: "His J22: =NORM.DIST(10.5,J19,J20,TRUE), NORM.DIST with the standard error, not σ.",
      traps: [{ value: normDist(a, m.mu, m.sd), why: "Used σ: the sample mean's standard deviation is the standard error." }, { value: 1 - pA, why: "That is the probability of more than a." }],
    });
    S.ask(`J${r(5)}`, {
      label: `Left value of the range with ${aPct(alpha)} chance of holding the sample mean`, cell: `M${r(5)}`, answer: left,
      formula: `=NORM.INV(H${r(4)}/2,H${r(1)},M${r(3)})`,
      explain: "Put α/2 in each tail: his H28 =NORM.INV(0.025,11,J20) for 95%.",
      traps: [{ value: normInvGeneral(alpha, m.mu, se), why: "Put all of α in one tail: use α/2." }, { value: normInvGeneral(alpha / 2, m.mu, m.sd), why: "Used σ instead of the standard error." }],
    });
    S.ask(`J${r(6)}`, {
      label: "Right value of that range", cell: `M${r(6)}`, answer: right,
      formula: `=NORM.INV(1-H${r(4)}/2,H${r(1)},M${r(3)})`,
      explain: "1 − α/2 to the left of the right value: his H29 =NORM.INV(0.975,11,J20).",
      traps: [{ value: normInvGeneral(1 - alpha, m.mu, se), why: "Used 1 − α: the right tail holds only α/2." }, { value: normInvGeneral(1 - alpha / 2, m.mu, m.sd), why: "Used σ instead of the standard error." }],
    });
    S.ask(`J${r(7)}`, {
      label: "Did your sample mean belong to this range? (Inside/Outside)", cell: `M${r(7)}`, answer: inside ? "Inside" : "Outside", options: INOUT,
      formula: `=IF(AND(M${r(1)}>=M${r(5)},M${r(1)}<=M${r(6)}),"Inside","Outside")`,
      explain: `If the claim is true the sample mean lands outside only ${Math.round(alpha * 100)}% of the time, so outside makes you doubt the claim (it is not proof).`,
    });
    tidy(S);
    return {
      tab: "Sample mean range", title: "Where will the sample mean land?",
      text: [
        `${m.what}. The amount X is normally distributed with mean μ = ${m.mu} ${m.unit} and σ = ${m.sd}.`,
        `You check by picking ${n} at random and measuring them (column D). Then you begin to doubt the claims: if the manufacturer is telling the truth, inside what range does the sample mean have ${aPct(alpha)} probability of appearing?`,
        "Fill the yellow cells with formulas that point at the data and the givens.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [`Simulate your own ${n} values with the RNG (Normal, mean ${m.mu}, standard deviation ${m.sd}) and check whether your sample mean lands in the range. Self-check: in a class, about ${Math.round(alpha * 100)}% of people should land outside.`],
    };
  },
};

// ---------- Q2: significance and the width of the range ----------
const alphas: BlockMaker = {
  key: "l13.alpha",
  title: "Significance α: ranges for the sample mean at 80/90/95/99%",
  make(rng): Block {
    const m = pick(rng, MACHINES);
    const n = pick(rng, [5, 9, 10, 16, 20, 25]);
    const se = m.sd / Math.sqrt(n);
    const AL = [0.2, 0.1, 0.05, 0.01];
    // An observed sample mean, a little or a lot away from μ.
    const side = pick(rng, [-1, 1]);
    const k = pick(rng, [0.7, 1.4, 1.9, 2.4, 2.8, 3.2]);
    const obs = round(m.mu + side * k * se, m.d);
    const sig = pick(rng, [0.05, 0.01, 0.1]);
    const pTail = side < 0 ? normDist(obs, m.mu, se) : 1 - normDist(obs, m.mu, se);
    const susp = pTail < sig;

    const S = new Sheet();
    const r = (i: number) => TOP + i;
    S.header(`B${r(0)}`, "Given").header(`D${r(0)}`, "Value");
    S.label(`B${r(1)}`, "mean μ").given(`D${r(1)}`, m.mu);
    S.label(`B${r(2)}`, "sigma σ").given(`D${r(2)}`, m.sd);
    S.label(`B${r(3)}`, "n").given(`D${r(3)}`, n);
    S.label(`B${r(4)}`, "standard error");
    S.parts.push({
      label: "Standard error", cell: `D${r(4)}`, answer: se, formula: `=D${r(2)}/SQRT(D${r(3)})`,
      explain: "σ/√n.", traps: [{ value: m.sd / n, why: "Divided by n instead of √n." }],
    });
    // The table of ranges.
    const top = r(6);
    S.header(`B${top}`, "alpha α").header(`C${top}`, "chance inside").header(`D${top}`, "left value").header(`E${top}`, "right value").header(`F${top}`, "width");
    AL.forEach((al, i) => {
      const row = top + 1 + i;
      S.given(`B${row}`, al).set(`C${row}`, pct(al), "data");
      const L = normInvGeneral(al / 2, m.mu, se), R = normInvGeneral(1 - al / 2, m.mu, se);
      S.parts.push({
        label: `Left value for α = ${al}`, cell: `D${row}`, answer: L, formula: `=NORM.INV(B${row}/2,$D$${r(1)},$D$${r(4)})`,
        explain: "α/2 to the left of the left value: NORM.INV(α/2, μ, standard error).",
        traps: [{ value: normInvGeneral(al, m.mu, se), why: "Used α instead of α/2." }, { value: normInvGeneral(al / 2, m.mu, m.sd), why: "Used σ instead of the standard error." }],
      });
      S.parts.push({
        label: `Right value for α = ${al}`, cell: `E${row}`, answer: R, formula: `=NORM.INV(1-B${row}/2,$D$${r(1)},$D$${r(4)})`,
        explain: "1 − α/2 to the left of the right value.",
        traps: [{ value: normInvGeneral(1 - al, m.mu, se), why: "Used 1 − α instead of 1 − α/2." }],
      });
      S.parts.push({
        label: `Width for α = ${al}`, cell: `F${row}`, answer: R - L, formula: `=E${row}-D${row}`,
        explain: "Right value minus left value. The smaller α, the wider the range.",
      });
    });
    const q = top + 6;
    S.label(`B${q}`, "An observed sample mean").given(`D${q}`, obs);
    S.label(`B${q + 1}`, "Your significance α").given(`D${q + 1}`, sig);
    S.ask(`F${q}`, {
      label: `Pr(a sample mean this far ${side < 0 ? "below" : "above"} μ or further)`, cell: `I${q}`, answer: pTail, format: "prob",
      formula: side < 0 ? `=NORM.DIST(D${q},D${r(1)},D${r(4)},TRUE)` : `=1-NORM.DIST(D${q},D${r(1)},D${r(4)},TRUE)`,
      explain: side < 0 ? "Below μ: NORM.DIST with the standard error gives the probability to the left." : "Above μ: 1 − NORM.DIST with the standard error gives the probability to the right.",
      traps: [{ value: 1 - pTail, why: "Took the wrong side: the observed mean is " + (side < 0 ? "below" : "above") + " μ." }],
    });
    S.ask(`F${q + 1}`, {
      label: "Is that suspiciously small? (Yes/No)", cell: `I${q + 1}`, answer: susp ? "Yes" : "No", options: ["Yes", "No"],
      formula: `=IF(I${q}<D${q + 1},"Yes","No")`,
      explain: "The significance α is a small probability you deem suspiciously small: compare the probability with α.",
    });
    tidy(S);
    return {
      tab: "Alpha and ranges", title: "Significance and ranges for the sample mean",
      text: [
        `${m.what}: the amount is normal with mean μ = ${m.mu} ${m.unit} and σ = ${m.sd}. You will take a sample of n = ${n}.`,
        "For each significance α, give the range inside which there is a (1 − α) probability the sample mean belongs, and its width.",
        "Then judge one observed sample mean against your significance α. Use formulas that point at the givens.",
      ],
      cells: S.cells, parts: S.parts,
    };
  },
};

export const LESSON_13: Lesson = {
  n: 13,
  title: "Confidence intervals: where the sample mean lands",
  unit: 2,
  week: "Week 8 · Wed 21 Oct · Confidence intervals",
  sources: ["Lesson 13, notes.xlsx", "F25_Exam 2 and solutions", "Exam 3 (Spring 2026)", "S26_Final and solutions", "F25_Final"],
  summary:
    "If you know the true mean and standard deviation, the sample mean is normal with mean μ and standard error σ/√n, so you can say in advance how likely it is to land below a value and inside what range it will land 95% (or any 1 − α) of the time. A sample mean outside that range is a reason to doubt the claim: this is the first confidence interval and the seed of hypothesis testing.",
  defs: [
    { term: "Why the normal matters", text: "Fact: the normal distribution is important. The quantity X is normally distributed with mean μ and standard deviation σ; equivalently, just write X ~ N(μ, σ²).", source: "Lesson 13, notes › Normal B2–B6" },
    { term: "A sample as random variables", text: "You can model a sample of size n by n identical and independent random variables X_1, X_2, …, X_n.", source: "Lesson 13, notes › Normal B8" },
    { term: "The sample mean is a random variable", text: "The sample mean X̄ is a continuous random variable which, if each X_i is normally distributed with mean μ and standard deviation σ, is X̄ ~ N(μ, standard error).", source: "Lesson 13, notes › Normal B10–B11" },
    { term: "Standard error", text: "Standard error = σ/√n.", source: "Lesson 13, notes › Normal F12" },
    { term: "Central Limit Theorem (for X̄)", text: "In fact the Central Limit Theorem says that even if the X_i are not normally distributed, for large n, X̄ ~ N(μ, standard error) is approximately true.", source: "Lesson 13, notes › Normal B13–B14" },
    { term: "Significance α", text: "The significance alpha α is a small probability which you (or someone who tells you) deem suspiciously small.", source: "Lesson 13, notes › Confidence interval B32" },
    { term: "Range for the sample mean (the potential task)", text: "You take a sample of n random variables with mean μ and standard deviation σ. For a given α, construct a confidence interval inside which there is a (1 − α) probability the sample mean belongs: left value =NORM.INV(α/2, μ, standard error), right value =NORM.INV(1 − α/2, μ, standard error).", source: "Lesson 13, notes › Confidence interval B34–B35, H28–H29" },
    { term: "Probability for the sample mean (key fact)", text: "Use NORM.DIST with the standard error as the standard deviation: Pr(X̄ < 10.5) =NORM.DIST(10.5, μ, standard error, TRUE).", source: "Lesson 13, notes › Confidence interval J22" },
  ],
  examples: [
    {
      title: "The cereal machine",
      setup:
        "A cereal machine dispenses an amount X that is normal with mean μ = 11 ounces and σ = 0.5. You grab 5 boxes at random and weigh them (his simulated sample below). What is the probability the sample mean is less than 10.5? If the manufacturer is telling the truth, inside what range does the sample mean have a 95% probability of appearing?",
      table: { head: ["Box", "Ounces"], rows: [[1, 11.516], [2, 11.1995], [3, 11.0240], [4, 9.9786], [5, 11.6763]] },
      steps: [
        { say: "Sample mean of the 5 boxes (C11:C15)", formula: "=AVERAGE(C11:C15)", result: "11.07888" },
        { say: "How far from the true mean", formula: "=ABS(G11-11)", result: "0.07888 ounces" },
        { say: "Standard error of X̄ (n = 5)", formula: "=0.5/SQRT(5)", result: "0.22361" },
        { say: "Pr(X̄ < 10.5): mean in J19, standard error in J20", formula: "=NORM.DIST(10.5,J19,J20,TRUE)", result: "0.01267" },
        { say: "Left value of the 95% range (2.5% to its left)", formula: "=NORM.INV(0.025,11,J20)", result: "10.56174" },
        { say: "Right value (97.5% to its left)", formula: "=NORM.INV(0.975,11,J20)", result: "11.43826" },
        { say: "Did the sample mean belong to this interval?", result: "Yes: 11.079 is between 10.562 and 11.438 (\"Mine did.\")" },
      ],
      takeaway: "For the sample mean, use NORM.DIST / NORM.INV with the standard error σ/√n, and put α/2 in each tail.",
      source: "Lesson 13, notes › Confidence interval",
    },
  ],
  quiz: [
    { q: "The significance α is…", options: ["A small probability you deem suspiciously small", "The standard deviation of the sample mean", "The width of the confidence interval", "The probability the claim is true"], answer: 0, why: "His definition: a small probability which you (or someone who tells you) deem suspiciously small." },
    { q: "Each X_i is N(μ, σ²). The sample mean of n of them is…", options: ["Normal with mean μ and standard deviation σ/√n", "Normal with mean μ and standard deviation σ", "Normal with mean μ/n and standard deviation σ/n", "Not a random variable: it is a fixed number"], answer: 0, why: "X̄ ~ N(μ, standard error) with standard error σ/√n. It is a random variable: a new sample gives a new X̄." },
    { q: "For a 95% range for the sample mean, which probability goes into NORM.INV for the left value?", options: ["0.025", "0.05", "0.95", "0.975"], answer: 0, why: "α = 0.05 is split over two tails: α/2 = 0.025 to the left of the left value (his =NORM.INV(0.025,11,J20))." },
    { q: "For a 90% range, the right value is…", options: ["NORM.INV(0.95, μ, σ/√n)", "NORM.INV(0.90, μ, σ/√n)", "NORM.INV(0.95, μ, σ)", "NORM.INV(0.05, μ, σ/√n)"], answer: 0, why: "α = 0.1, so 1 − α/2 = 0.95 lies to the left of the right value, with the standard error as the standard deviation." },
    { q: "As α gets smaller (say from 0.1 to 0.01), the range for the sample mean…", options: ["Gets wider", "Gets narrower", "Stays the same width"], answer: 0, why: "A 99% range must catch the sample mean more often than a 90% one, so it is wider." },
    { q: "Cereal: μ = 11, σ = 0.5, n = 5. Pr(X̄ < 10.5) is…", options: ["=NORM.DIST(10.5,11,0.5/SQRT(5),TRUE)", "=NORM.DIST(10.5,11,0.5,TRUE)", "=1-NORM.DIST(10.5,11,0.5/SQRT(5),TRUE)", "=NORM.INV(10.5,11,0.5/SQRT(5))"], answer: 0, why: "Probability to the left, for X̄, so the standard error 0.5/√5 goes in NORM.DIST (≈ 0.0127)." },
    { q: "A student's sample mean falls outside the 95% range. Does that prove they made a mistake?", options: ["No: it happens 5% of the time even when everything is right, but it makes us suspicious", "Yes: the sample mean can never land outside", "Yes, because 95% is close to 100%", "No, because the range is always wrong"], answer: 0, why: "A correct simulation lands outside a 95% range 5% of the time (S26 Exam 3 Q2 asked exactly this)." },
  ],
  excel: [
    { fn: "AVERAGE", use: "Sample mean of the simulated sample." },
    { fn: "ABS", use: "How far the sample mean is from the true mean: =ABS(G11-11)." },
    { fn: "SQRT", use: "Standard error =σ/SQRT(n)." },
    { fn: "NORM.DIST(x, μ, standard error, TRUE)", use: "Probability the sample mean is less than x (1 − it for more than x)." },
    { fn: "NORM.INV(α/2, μ, standard error) and NORM.INV(1 − α/2, μ, standard error)", use: "Left and right values of the range with a (1 − α) chance of holding the sample mean." },
    { fn: "Data Analysis › Random Number Generation", use: "Normal distribution with the given mean and standard deviation to simulate a sample." },
  ],
  watch: [
    "S26 Exam 3 Q1: μ = 55, σ = 5, a student simulates 5 numbers: \"construct an interval inside which there is a 95% chance that the student's sample mean belongs\" (answer cells: alpha, n, Z, sigma, mu, lower limit, upper limit). Q2 is the written follow-up: a sample mean outside does not prove a mistake, it happens 5% of the time.",
    "S26 Final Q32: before someone generates 8 numbers with μ = 20, σ = 2, a 90% interval for their sample mean: =20-(2/SQRT(8))*NORM.S.INV(0.95) to =20+(2/SQRT(8))*NORM.S.INV(0.95).",
    "F25 Exam 2 Q1: standard error for n = 17 (=15/SQRT(17)), then a 90% range for the sample mean before sampling: =525-F10*NORM.S.INV(0.95) and =525+F10*NORM.S.INV(0.95). F25 Final CI Q1 is the same with pints of beer (568 ml, σ = 15, n = 6, 95%).",
    "Exam answers can use either NORM.INV(α/2, μ, SE) as in these notes, or μ ∓ NORM.S.INV(1 − α/2)·SE as in Lesson 14 and the exam solutions: they give the same numbers.",
    "Slips: σ instead of σ/√n; α instead of α/2 in a tail; the right value from NORM.INV(1 − α) instead of NORM.INV(1 − α/2).",
  ],
  makers: [cereal, alphas],
};
