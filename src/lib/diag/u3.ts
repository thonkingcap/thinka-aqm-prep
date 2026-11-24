// Unit 3 diagnostic (BETA): regression. Unit 3 is taught after Thanksgiving (Mon 30 Nov introduction to
// regression, Wed 2 Dec residual analysis, Mon 7 Dec multiple linear regression) and has no midterm, so this paper
// is modelled on the regression parts of his finals, which is where students will meet it:
//   • "Regression" tab   ← Spring 2026 Final, section 8 (Final.txt; S26_Final, solutions › Regression):
//                          scatter chart with trendline [3], intercept/slope/prediction [3], critical value test of
//                          "no linear relationship" with t on n − 2 df [4]. Same weights, same answer block.
//   • "Residual analysis" ← Fall 2025 Final, Residual Analysis sheet (F25_Final.md): intercept and slope in cells to
//                          the right, R² "correct to 3 d.p.", Prediction and Residuals columns, "is a simple model
//                          appropriate?", the residual charts. Fewer points than his 18 (a 45-minute paper).
//   • "Multiple regression" ← Fall 2025 Final, Regression sheet: a 0/1 dummy column, a Toolpak multiple regression,
//                          a prediction. The coefficient cells and the dummy t test (Q10, Q12) are our anticipation
//                          (l21's "dummy" block), not a past question.
// New scenarios and numbers throughout; one fixed seed per section, so the paper is identical every build.
// Values read from the Toolpak / trendline are pink (fixed by the data, computed here by least squares in l19.ts);
// computed answers are blue formulas.
import { qn, table, label, hint, col, DECISIONS, decide, type DPaper, type DSection, type DPart, type Cell } from "./kit.ts";
import { mulberry32, gauss, int, round, tolFor } from "../lessons/kit.ts";
import { ols, tinv, pTwo, meanOf } from "../lessons/l19.ts";

/** A part, dropping any trap that sits too close to the answer (checkPaper rejects those). */
function part(p: DPart): DPart {
  if (!p.traps) return p;
  const tol = tolFor(p);
  const traps = p.traps.filter((t) => Number.isFinite(t.value) && Math.abs(t.value - Number(p.answer)) > tol * 1.5 + 1e-12);
  const q = { ...p };
  if (traps.length) q.traps = traps; else delete q.traps;
  return q;
}
/** A typed number as a key formula, at full precision. */
const num = (v: number) => `=${String(v)}`;
const sign = (t: number, tCell: string, dfCell: string) =>
  t < 0 ? `=2*T.DIST(${tCell},${dfCell},TRUE)` : `=2*(1-T.DIST(${tCell},${dfCell},TRUE))`;

// =====================================================================================================
// 1. Regression (Spring 2026 Final, section 8)
// =====================================================================================================
const N1 = 18, TEMP0 = 10, ALPHA1 = 0.01;
const cafe = (() => {
  const rng = mulberry32(30111);
  for (let k = 0; k < 2000; k++) {
    const temp = Array.from({ length: N1 }, () => int(rng, 1, 24));
    if (new Set(temp).size < 10) continue;
    // Hot drinks sold fall as the outside temperature rises.
    const drinks = temp.map((a) => Math.round(310 - 7.5 * a + 30 * gauss(rng)));
    if (drinks.some((p) => p < 60)) continue;
    const o = ols([temp], drinks);
    // Comfortably beyond the α = 0.01 critical values (±2.921 on 16 df), p far from α.
    if (o.t[1] > -4.2 || o.t[1] < -5.8) continue;
    return { temp, drinks, o };
  }
  throw new Error("u3: no café data");
})();

const regression: DSection = (() => {
  const { temp, drinks, o } = cafe;
  const [b0, b1] = o.b;
  const df = N1 - 2;
  const t = o.t[1];
  const lower = tinv(ALPHA1 / 2, df), upper = tinv(1 - ALPHA1 / 2, df);
  const reject = t < lower || t > upper;
  const c: Record<string, Cell> = {};
  const first = 4, last = first + N1 - 1;
  const Y = `D${first}:D${last}`, X = `E${first}:E${last}`;
  qn(c, 1, 2); table(c, "C2", "Table 1"); hint(c, "G2", "Chart here");
  table(c, "C3", "Day"); table(c, "D3", "Hot drinks sold"); table(c, "E3", "Temperature");
  col(c, "C", first, temp.map((_, i) => i + 1)); col(c, "D", first, drinks); col(c, "E", first, temp);
  const rB0 = last + 3, rB1 = rB0 + 2, rP = rB1 + 2;
  qn(c, 2, rB0);
  label(c, `D${rB0}`, "y intercept"); hint(c, `G${rB0}`, "Correct to 3 d.p.");
  label(c, `D${rB1}`, "slope"); hint(c, `G${rB1}`, "Correct to 3 d.p.");
  label(c, `D${rP}`, "Predicted hot drinks");
  const rA = rP + 2;
  qn(c, 3, rA);
  const blk = ["alpha", "degrees of freedom", "test statistic", "lower critical value", "upper critical value", "decision"];
  blk.forEach((l, i) => label(c, `C${rA + i}`, l));
  hint(c, `E${rA + 5}`, "Write R for reject and DR for don't reject");
  const D = (i: number) => `D${rA + i}`;
  // The slope's swapped-axes values (X regressed on Y), a classic slip with SLOPE/INTERCEPT.
  const ox = ols([drinks], temp);
  return {
    tab: "Regression", title: "Regression",
    items: [
      { kind: "lead", text: `Table 1 shows a sample of ${N1} days at a café, the number of hot drinks sold and the outside temperature at noon in °C.` },
      { kind: "q", n: 1, text: "Produce an appropriate chart in the space provided showing how the number of hot drinks sold depends on temperature. Include a trendline.", points: 3 },
      { kind: "q", n: 2, text: `Find the y-intercept and slope for the line of best fit and use this to predict the number of hot drinks sold on a day when the temperature is ${TEMP0}°C.`, points: 3 },
      { kind: "lead", text: "We will test a null hypothesis which claims that there is no linear relationship between temperature and hot drinks sold." },
      { kind: "q", n: 3, text: `For a significance of α = ${ALPHA1} decide whether to reject (R) or don't reject (DR) the null hypothesis by performing a critical value test.`, points: 4 },
    ],
    cells: c,
    questions: [
      {
        n: 1, points: 3, lesson: 19, title: "Scatter chart with trendline", parts: [],
        unmarked: `A scatter (XY) chart with Temperature on the horizontal axis and Hot drinks sold on the vertical axis (sales depend on temperature), a linear trendline, a title and axis titles. The trendline equation should read y = ${round(b1, 3)}x + ${round(b0, 3)}: a downward line.`,
      },
      {
        n: 2, points: 3, lesson: 19, title: "Line of best fit and a prediction", parts: [
          part({
            label: "y intercept", cell: `E${rB0}`, tone: "pink", answer: b0, formula: `=INTERCEPT(${Y},${X})`,
            explain: "Read it from the trendline equation or the Toolpak's Intercept coefficient (the Spring 2026 key typed it, correct to 3 d.p.). =INTERCEPT(Y range, X range) gives it too: Hot drinks sold is Y, Temperature is X.",
            traps: [{ value: ox.b[0], why: "Swapped X and Y: INTERCEPT wants the Hot drinks sold (Y) column first." }],
          }),
          part({
            label: "slope", cell: `E${rB1}`, tone: "pink", answer: b1, formula: `=SLOPE(${Y},${X})`,
            explain: "The change in predicted hot drinks sold for each extra °C (negative: warmer days sell fewer). From the trendline, the Toolpak's Temperature coefficient, or =SLOPE(Y range, X range).",
            traps: [{ value: ox.b[1], why: "Swapped X and Y: SLOPE wants the Hot drinks sold (Y) column first." }],
          }),
          part({
            label: "Predicted hot drinks", cell: `E${rP}`, tone: "blue", answer: b0 + TEMP0 * b1, formula: `=E${rB0}+${TEMP0}*E${rB1}`,
            explain: `Prediction = y-intercept + ${TEMP0} × slope, as in the Spring 2026 Final solution (=E26+6*E28).`,
            traps: [{ value: TEMP0 * b1, why: "Forgot to add the y-intercept." }, { value: b1 + TEMP0 * b0, why: "Swapped the intercept and the slope." }],
          }),
        ],
      },
      {
        n: 3, points: 4, lesson: 20, title: "Is there a linear relationship? (critical values)", parts: [
          part({ label: "alpha", cell: D(0), tone: "pink", answer: ALPHA1, tol: 0, formula: num(ALPHA1), explain: "The significance given in the question." }),
          part({
            label: "degrees of freedom", cell: D(1), tone: "pink", answer: df, tol: 0, formula: num(df),
            explain: `n − 2 = ${N1} − 2: the slope's t statistic has n − 2 degrees of freedom (the Residual df in the Toolpak's ANOVA table).`,
            traps: [{ value: N1 - 1, why: "n − 1 is for a one-sample test of a mean; the slope test uses n − 2." }],
          }),
          part({
            label: "test statistic", cell: D(2), tone: "blue", answer: t, formula: `=SLOPE(${Y},${X})/(STEYX(${Y},${X})/SQRT(DEVSQ(${X})))`,
            explain: "t = Temperature coefficient ÷ its Standard Error, from your Toolpak regression output (the Spring 2026 key: =L40/M40). Without the Toolpak: SLOPE ÷ (STEYX/√DEVSQ(X)). It equals the report's t Stat for Temperature.",
            traps: [{ value: o.t[0], why: "Used the Intercept row: the test is about the slope (the Temperature row)." }, { value: -t, why: "Lost the sign: the slope is negative, so t is negative." }],
          }),
          part({
            label: "lower critical value", cell: D(3), tone: "blue", answer: lower, formula: `=T.INV(${D(0)}/2,${D(1)})`,
            explain: "Two tails, so α/2 in each: =T.INV(α/2, n − 2).",
            traps: [{ value: tinv(ALPHA1, df), why: "Used α instead of α/2: the test has two tails." }],
          }),
          part({
            label: "upper critical value", cell: D(4), tone: "blue", answer: upper, formula: `=T.INV(1-${D(0)}/2,${D(1)})`,
            explain: "=T.INV(1 − α/2, n − 2), exactly as the Spring 2026 Final solution (=T.INV(1-D32/2,D33)).",
            traps: [{ value: tinv(1 - ALPHA1, df), why: "Used 1 − α instead of 1 − α/2: the test has two tails." }, { value: tinv(1 - ALPHA1 / 2, N1 - 1), why: "Used n − 1 degrees of freedom." }],
          }),
          part({
            label: "decision", cell: D(5), tone: "pink", answer: decide(reject), options: DECISIONS, formula: `"${reject ? "R" : "DR"}"`,
            explain: reject
              ? `t = ${round(t, 4)} is below the lower critical value ${round(lower, 4)}, in the rejection tail: R. (p = ${round(pTwo(t, df), 6)} < ${ALPHA1}, the Toolpak's P-value for Temperature.) Temperature and hot drinks sold are linearly related.`
              : `t = ${round(t, 4)} lies between the critical values: DR.`,
          }),
        ],
      },
    ],
    widths: { 2: 12, 3: 16, 4: 13 },
  };
})();

// =====================================================================================================
// 2. Residual analysis (Fall 2025 Final, Residual Analysis sheet)
// =====================================================================================================
const N2 = 25;
const ASSUMPTIONS = ["Linearity", "Independence", "Normality", "Equal variances", "None"];
const training = (() => {
  const rng = mulberry32(30222);
  for (let k = 0; k < 4000; k++) {
    const h = Array.from({ length: N2 }, () => round(40 * rng(), 1));
    // Orders packed level off with training (a learning curve): a clear bend, so a straight line is the wrong shape.
    const y = h.map((v) => Math.round(110 + 250 * (1 - Math.exp(-v / 9)) + 14 * gauss(rng)));
    const o = ols([h], y);
    if (o.r2 < 0.72 || o.r2 > 0.9) continue;
    const m = meanOf(h);
    const tq = ols([h, h.map((v) => (v - m) ** 2)], y).t[2];
    if (tq > -7) continue; // the curvature is unmistakable (quadratic term's |t| > 7)
    // Residual pattern: negative at both ends, positive in the middle.
    const idx = h.map((_, i) => i).sort((a, b) => h[a] - h[b]);
    const third = Math.floor(N2 / 3);
    const avg = (ids: number[]) => ids.reduce((s, i) => s + o.resid[i], 0) / ids.length;
    if (!(avg(idx.slice(0, third)) < -10 && avg(idx.slice(third, N2 - third)) > 8 && avg(idx.slice(N2 - third)) < -5)) continue;
    // Spread not the story: compare the residual sizes in the lowest and highest thirds of hours.
    const rms = (ids: number[]) => Math.sqrt(ids.reduce((s, i) => s + o.resid[i] ** 2, 0) / ids.length);
    const ratio = rms(idx.slice(N2 - third)) / rms(idx.slice(0, third));
    if (ratio < 0.5 || ratio > 2) continue;
    return { h, y, o, tq };
  }
  throw new Error("u3: no training data");
})();

const residual: DSection = (() => {
  const { h, y, o } = training;
  const [b0, b1] = o.b;
  const c: Record<string, Cell> = {};
  qn(c, 4, 2);
  label(c, "C2", "y-intercept"); hint(c, "F2", "(answer correct to 3 d.p.)");
  label(c, "C3", "slope"); hint(c, "F3", "(answer correct to 3 d.p.)");
  qn(c, 5, 5); label(c, "C5", "R-squared"); hint(c, "F5", "Correct to 3 d.p.");
  const top = 8, first = top + 1, last = first + N2 - 1;
  qn(c, 6, 7); table(c, "C7", "Table 2");
  ["Employee", "Hours of training", "Orders packed", "Prediction", "Residuals"].forEach((t, j) => table(c, `${"CDEFG"[j]}${top}`, t));
  col(c, "C", first, h.map((_, i) => i + 1)); col(c, "D", first, h); col(c, "E", first, y);
  hint(c, "I7", "Insert charts here (Question 8)");
  const rOk = last + 3, rWhich = rOk + 1, rCh = rOk + 3;
  qn(c, 7, rOk);
  label(c, `C${rOk}`, "Appropriate?"); hint(c, `F${rOk}`, "Write Yes or No");
  label(c, `C${rWhich}`, "Assumption"); hint(c, `F${rWhich}`, "Write Linearity, Independence, Normality, Equal variances or None");
  qn(c, 8, rCh); hint(c, `C${rCh}`, "Charts in the space to the right of Table 2 (I7 onwards); put the Toolpak histogram output there too.");
  const preds: DPart[] = [], res: DPart[] = [];
  for (let i = 0; i < N2; i++) {
    const r = first + i;
    preds.push(part({
      label: `Prediction, employee ${i + 1}`, cell: `F${r}`, tone: "blue", answer: o.fitted[i], formula: `=$E$2+$E$3*D${r}`,
      explain: "Prediction = y-intercept + slope × hours, using your cells E2 and E3 locked with $ so the formula fills down (as the Fall 2025 Final asked).",
      traps: [{ value: b1 + b0 * h[i], why: "Swapped the intercept and the slope." }],
    }));
    res.push(part({
      label: `Residual, employee ${i + 1}`, cell: `G${r}`, tone: "blue", answer: o.resid[i], formula: `=E${r}-F${r}`,
      explain: "Residual = observed − predicted (orders packed minus the prediction).",
      traps: [{ value: -o.resid[i], why: "Did predicted − observed: the residual is observed − predicted." }],
    }));
  }
  const Yr = `E${first}:E${last}`, Xr = `D${first}:D${last}`;
  return {
    tab: "Residual analysis", title: "Residual analysis",
    items: [
      { kind: "lead", text: `Table 2 shows the number of hours of training that ${N2} new employees at a warehouse received and the number of orders each of them packed in their first week.` },
      { kind: "q", n: 4, text: "Find the y-intercept and slope of the line of best fit showing how the number of orders packed depends on hours of training. Enter them into cells E2 and E3.", points: 2 },
      { kind: "q", n: 5, text: "What is the R-squared score for this regression?", points: 1 },
      { kind: "q", n: 6, text: "Using your y-intercept and slope, complete the entries in Table 2.", points: 3 },
      { kind: "q", n: 7, text: "Is a simple regression model an appropriate model for this data? Write Yes or No, and write which of the LINE assumptions is most clearly not satisfied (write None if they all hold).", points: 2 },
      { kind: "q", n: 8, text: "In the space provided produce a predictor-residual chart and, using the Data Analysis Toolpak, a histogram of the residuals.", points: 2 },
    ],
    cells: c,
    questions: [
      {
        n: 4, points: 2, lesson: 19, title: "Intercept and slope", parts: [
          part({ label: "y-intercept", cell: "E2", tone: "pink", answer: b0, formula: `=INTERCEPT(${Yr},${Xr})`, explain: "From a trendline, the Toolpak's Intercept coefficient, or =INTERCEPT(Y range, X range) with Orders packed as Y." }),
          part({ label: "slope", cell: "E3", tone: "pink", answer: b1, formula: `=SLOPE(${Yr},${Xr})`, explain: "From a trendline, the Toolpak's coefficient for hours, or =SLOPE(Y range, X range)." }),
        ],
      },
      {
        n: 5, points: 1, lesson: 19, title: "R-squared", parts: [
          part({
            label: "R-squared", cell: "E5", tone: "pink", answer: o.r2, format: "prob", formula: `=RSQ(${Yr},${Xr})`,
            explain: "The Toolpak's R Square (or =RSQ(Y range, X range)): the share of the variation in orders packed explained by the line. High, yet the next questions show a straight line is the wrong shape.",
            traps: [{ value: Math.sqrt(o.r2), why: "That is Multiple R (r), not R²." }],
          }),
        ],
      },
      { n: 6, points: 3, lesson: 20, title: "Predictions and residuals", parts: [...preds, ...res] },
      {
        n: 7, points: 2, lesson: 20, title: "Is a simple model appropriate?", parts: [
          part({
            label: "Appropriate? (Yes/No)", cell: `E${rOk}`, tone: "pink", answer: "No", options: ["Yes", "No"], formula: `"No"`,
            explain: `No. Despite R² = ${round(o.r2, 3)}, orders packed rise quickly with the first hours of training and then level off: the points bend away from the trendline. The residuals are negative for few and for many hours and positive in the middle, a curve, not random noise. On the real exam (Fall 2025 Final, Residual Analysis Q4) this answer is a written justification worth 2 points, not a Yes/No: practise writing two or three sentences that name the pattern and the assumption it breaks.`,
          }),
          part({
            label: "Assumption most clearly not satisfied", cell: `E${rWhich}`, tone: "pink", answer: "Linearity", options: ASSUMPTIONS, formula: `"Linearity"`,
            explain: "Linearity: the relationship is curved (a learning curve that levels off), which shows as a U-shaped (here an upside-down U) pattern in the predictor-residual chart. Like the Fall 2025 Final's hours-studied data, which hit the 100% ceiling.",
          }),
        ],
      },
      {
        n: 8, points: 2, lesson: 20, title: "Residual charts", parts: [],
        unmarked: "Predictor-residual chart: a scatter chart with hours of training on the horizontal axis and the residuals (G column) on the vertical axis; it should show an upside-down U (negative, then positive, then negative), not a random band around 0. Histogram: Data Analysis > Histogram on the Residuals column with evenly spaced bins; roughly centred at 0 and not far from bell-shaped for 25 points (normality is not the clear problem here: the curve is). On the real exam (Fall 2025 Final, Residual Analysis Q4–Q5) the \"is a simple model appropriate?\" answer is a written justification, and there are three residual charts, each with a written comment on whether it supports its assumption: the ordered-residuals chart (independence), the histogram of residuals (normality) and the predictor-residual scatter (equal variances), 3 points each. Practise all three charts and the written comments too, in good English.",
      },
    ],
    widths: { 2: 12, 3: 16, 4: 14, 5: 12, 6: 12 },
  };
})();

// =====================================================================================================
// 3. Multiple regression (Fall 2025 Final, Regression sheet: dummy, Toolpak, prediction)
// =====================================================================================================
const N3 = 30, EXP0 = 6, ALPHA3 = 0.05;
const reps = (() => {
  const rng = mulberry32(30333);
  for (let k = 0; k < 4000; k++) {
    const exp = Array.from({ length: N3 }, () => int(rng, 0, 20));
    const work = Array.from({ length: N3 }, () => (rng() < 0.5 ? "Remote" : "Office"));
    const nR = work.filter((w) => w === "Remote").length;
    if (nR < 11 || nR > 19) continue;
    const d = work.map((w) => (w === "Remote" ? 1 : 0));
    const sales = exp.map((e, i) => round(38 + 2.6 * e + 1.2 * d[i] + 6 * gauss(rng), 1));
    const o = ols([exp, d], sales);
    // Experience clearly matters; working remotely clearly does not (p far above α = 0.05).
    if (o.p[1] > 1e-4 || o.p[2] < 0.25 || o.p[2] > 0.7) continue;
    return { exp, work, d, sales, o };
  }
  throw new Error("u3: no sales-rep data");
})();

const multiple: DSection = (() => {
  const { exp, work, d, sales, o } = reps;
  const [b0, b1, b2] = o.b;
  const df = N3 - 3;
  const t2 = o.t[2], p2 = o.p[2];
  const c: Record<string, Cell> = {};
  qn(c, 9, 3); table(c, "C3", "Table 3");
  const top = 4, first = 5, last = first + N3 - 1;
  ["Rep", "Works", "Sales (Y)", "Experience (X1)", "Dummy (X2)"].forEach((t, j) => table(c, `${"CDEFG"[j]}${top}`, t));
  col(c, "C", first, exp.map((_, i) => i + 1)); col(c, "D", first, work, "left"); col(c, "E", first, sales); col(c, "F", first, exp);
  hint(c, "I3", "Regression output here (Question 10): output it to cell I4");
  const r10 = last + 3;
  qn(c, 10, r10);
  label(c, `C${r10}`, "Intercept"); label(c, `C${r10 + 1}`, "Experience (X1)"); label(c, `C${r10 + 2}`, "Dummy (X2)");
  hint(c, `F${r10}`, "Coefficients from your regression output (correct to 3 d.p.)");
  const r11 = r10 + 4;
  qn(c, 11, r11); label(c, `C${r11}`, "Predicted sales");
  const r12 = r11 + 2;
  qn(c, 12, r12);
  ["alpha", "degrees of freedom", "standard error (dummy)", "test statistic", "p value", "decision"].forEach((l, i) => label(c, `C${r12 + i}`, l));
  hint(c, `F${r12 + 5}`, "Write R for reject and DR for don't reject");
  const E = (r: number) => `E${r}`;
  const dummies: DPart[] = d.map((v, i) => part({
    label: `Dummy, rep ${i + 1}`, cell: `G${first + i}`, tone: "blue", answer: v, tol: 0, formula: `=IF(D${first + i}="Remote",1,0)`,
    explain: "The dummy records the category as a number: 1 for Remote, 0 for Office. =IF(D5=\"Remote\",1,0), filled down.",
    traps: [{ value: 1 - v, why: "Coded it the other way round: the question says 1 for Remote." }],
  }));
  const pred = b0 + b1 * EXP0 + b2;
  return {
    tab: "Multiple regression", title: "Multiple regression",
    items: [
      { kind: "lead", text: `Table 3 shows the monthly sales (in thousands of USD) of ${N3} sales representatives at a company, their years of experience and whether they work remotely or in the office. We wish to include a dummy variable to record whether a sales representative works remotely.` },
      { kind: "q", n: 9, text: "Implement this variable by completing the entries in Table 3. The dummy should be 1 for Remote and 0 for Office.", points: 1 },
      { kind: "q", n: 10, text: "Perform a multiple regression analysis using the Data Toolpak and output the results in cell I4. Write the intercept and the two coefficients into the cells provided.", points: 3 },
      { kind: "q", n: 11, text: `What monthly sales does the multiple regression model predict for a remote sales representative with ${EXP0} years of experience?`, points: 2 },
      { kind: "q", n: 12, text: `Test the null hypothesis that working remotely makes no difference to monthly sales, i.e. H_{0}: the coefficient of the dummy variable is zero, with α = ${ALPHA3}.`, points: 3 },
    ],
    cells: c,
    questions: [
      { n: 9, points: 1, lesson: 21, title: "Dummy variable", parts: dummies },
      {
        n: 10, points: 3, lesson: 21, title: "Toolpak multiple regression", parts: [
          part({ label: "Intercept", cell: E(r10), tone: "pink", answer: b0, formula: num(b0), explain: "The Intercept row of the Coefficients column. Input Y Range = Sales (E4:E34), Input X Range = Experience and Dummy together (F4:G34, side by side), Labels ticked." }),
          part({ label: "Experience coefficient", cell: E(r10 + 1), tone: "pink", answer: b1, formula: num(b1), explain: "Extra predicted monthly sales (thousands of USD) for each extra year of experience, holding the work arrangement fixed." }),
          part({ label: "Dummy coefficient", cell: E(r10 + 2), tone: "pink", answer: b2, formula: num(b2), explain: "The difference in predicted sales between a remote and an office rep with the same experience." }),
        ],
      },
      {
        n: 11, points: 2, lesson: 21, title: "Prediction with a dummy", parts: [
          part({
            label: "Predicted sales", cell: E(r11), tone: "blue", answer: pred, formula: `=${E(r10)}+${E(r10 + 1)}*${EXP0}+${E(r10 + 2)}*1`,
            explain: `Remote means dummy = 1: ŷ = b₀ + b₁ × ${EXP0} + b₂ × 1 (the Fall 2025 Final asked this for a white wine with 7% alcohol).`,
            traps: [{ value: b0 + b1 * EXP0, why: "Left out the dummy term: for a remote rep the dummy is 1." }, { value: b1 * EXP0 + b2, why: "Forgot the intercept." }],
          }),
        ],
      },
      {
        n: 12, points: 3, lesson: 21, title: "Is the dummy significant?", parts: [
          part({ label: "alpha", cell: E(r12), tone: "pink", answer: ALPHA3, tol: 0, formula: num(ALPHA3), explain: "The significance given in the question." }),
          part({
            label: "degrees of freedom", cell: E(r12 + 1), tone: "pink", answer: df, tol: 0, formula: num(df),
            explain: `n − k − 1 = ${N3} − 2 − 1 with k = 2 X variables: the Residual df in the ANOVA table.`,
            traps: [{ value: N3 - 2, why: "n − 2 is for simple regression; with two X variables it is n − 3." }, { value: N3 - 1, why: "n − 1 is the Total df." }],
          }),
          part({
            label: "standard error (dummy)", cell: E(r12 + 2), tone: "pink", answer: o.se[2], formula: num(o.se[2]),
            explain: "Read from the Standard Error column of your regression output, in the Dummy (X2) row.",
            traps: [{ value: o.s, why: "That is the Standard Error under Regression Statistics (of the estimate), not the dummy's." }],
          }),
          part({
            label: "test statistic", cell: E(r12 + 3), tone: "blue", answer: t2, formula: `=${E(r10 + 2)}/${E(r12 + 2)}`,
            explain: "t = dummy coefficient ÷ its standard error, as in the Spring 2026 slope test (=L40/M40). It equals the output's t Stat for the dummy.",
          }),
          part({
            label: "p value", cell: E(r12 + 4), tone: "blue", answer: p2, format: "prob", formula: sign(t2, E(r12 + 3), E(r12 + 1)),
            explain: `${t2 < 0 ? "t is negative, so p = 2*T.DIST(t, df, TRUE)" : "t is positive, so p = 2*(1-T.DIST(t, df, TRUE))"} on n − 3 df. It matches the output's P-value for the dummy.`,
            traps: [{ value: p2 / 2, why: "Forgot to double: the test is two-tailed." }, { value: pTwo(t2, N3 - 2), why: "Used n − 2 degrees of freedom; with two X variables use n − 3." }],
          }),
          part({
            label: "decision", cell: E(r12 + 5), tone: "pink", answer: decide(p2 < ALPHA3), options: DECISIONS, formula: `"${p2 < ALPHA3 ? "R" : "DR"}"`,
            explain: p2 < ALPHA3
              ? `p = ${round(p2, 4)} < ${ALPHA3}: R.`
              : `p = ${round(p2, 4)} ≥ ${ALPHA3}: DR. Once experience is allowed for, working remotely makes no significant difference to sales (like the wine type in the Fall 2025 data).`,
          }),
        ],
      },
    ],
    widths: { 2: 14, 3: 10, 4: 16, 5: 12 },
  };
})();

export const DIAG_U3: DPaper = {
  id: "dx:u3",
  title: "Unit 3 diagnostic (BETA)",
  header: "AQM1000, Fall 2026, Unit 3 diagnostic (AQM Prep, BETA)",
  file: "AQM-Unit-3-diagnostic",
  minutes: 45,
  beta: true,
  instructions: [
    "This exam is 45 minutes long.",
    "You are permitted to bring a double-sided handwritten note-sheet on standard letter size paper.",
    "Your answers are to be inputted in the Excel file provided.",
    "No window other than the Excel file should be open on your screen for the duration of the exam.",
    "Answers should be inputted into the designated cells.",
    "Do not move the location of an answer cell in the spreadsheet.",
    "Do not rename sheets.",
    "Do not round numerical answers, leave them as exact as possible.",
    "Blue answer cells need to contain an Excel formula to receive credit. Pink cells just require the answer.",
    "For hypothesis testing simply write R for reject and DR for don't reject.",
    "BETA: regression (Unit 3) is taught after Thanksgiving and has no midterm. This paper is modelled on the regression sections of the Spring 2026 and Fall 2025 finals.",
  ],
  sections: [regression, residual, multiple],
};
