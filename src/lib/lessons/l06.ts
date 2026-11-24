// Lesson 6: Histograms (Week 4, Mon 21 Sep). Built from "Lesson 6, notes" (sheets "age" and "Histograms"):
// outlier definitions, the table of numerical descriptive measures, Toolpak histograms, symmetric/bimodal/skewed.
import { Sheet, gauss, int, pick, TOP, type Block, type BlockMaker, type Rng, type Trap } from "./kit.ts";
import type { Lesson } from "./types.ts";

// ---------- local statistics helpers (independent of the formula engine) ----------
const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
const devsq = (x: number[]) => { const m = mean(x); return x.reduce((s, v) => s + (v - m) ** 2, 0); };
const varS = (x: number[]) => devsq(x) / (x.length - 1);
const varP = (x: number[]) => devsq(x) / x.length;
const sorted = (x: number[]) => [...x].sort((a, b) => a - b);
function pctInc(x: number[], p: number) {
  const s = sorted(x), h = p * (s.length - 1), lo = Math.floor(h);
  return lo + 1 >= s.length ? s[lo] : s[lo] + (h - lo) * (s[lo + 1] - s[lo]);
}
const median = (x: number[]) => pctInc(x, 0.5);
/** Excel's PERCENTILE.EXC / QUARTILE.EXC rule: position p(n + 1), interpolated; NaN where Excel gives #NUM!. */
function pctExc(x: number[], p: number) {
  const s = sorted(x), n = s.length, h = p * (n + 1);
  if (h < 1 || h > n) return NaN;
  const lo = Math.floor(h);
  return lo >= n ? s[n - 1] : s[lo - 1] + (h - lo) * (s[lo] - s[lo - 1]);
}
/** The .EXC value as an accepted alternative, when Excel can compute it and it differs from the .INC key. */
const altsFor = (inc: number, exc: number, tol: number): number[] => (Number.isFinite(exc) && Math.abs(exc - inc) > tol ? [exc] : []);
const EXC_OK = "QUARTILE.EXC also counts: he has used both (.EXC on this term's Exam 1 key).";
function counts(x: number[]) { const m = new Map<number, number>(); for (const v of x) m.set(v, (m.get(v) ?? 0) + 1); return m; }
function forceMode(rng: Rng, x: number[]): number[] {
  const c = counts(x), best = Math.max(...c.values()), md = median(x);
  const tied = [...c.keys()].filter((v) => c.get(v) === best);
  const near = Math.min(...tied.map((v) => Math.abs(v - md)));
  const m = pick(rng, tied.filter((v) => Math.abs(v - md) === near));
  const others = x.map((v, i) => (v === m ? -1 : i)).filter((i) => i >= 0);
  const out = [...x];
  out[pick(rng, others)] = m;
  return out;
}
function modeOf(x: number[]) { const c = counts(x), best = Math.max(...c.values()); return x.find((v) => c.get(v) === best)!; }
const traps = (answer: number, tol: number, ts: Trap[], alts: number[] = []): Trap[] =>
  ts.filter((t) => Number.isFinite(t.value) && [answer, ...alts].every((a) => Math.abs(t.value - a) > 1.5 * tol + 1e-9));
/** Q1, Q3 and the IQR-rule limits by one quartile method. */
function fences(x: number[], q: (x: number[], p: number) => number) {
  const q1 = q(x, 0.25), q3 = q(x, 0.75), iqr = q3 - q1;
  return { q1, q3, iqr, lo: q1 - 1.5 * iqr, hi: q3 + 1.5 * iqr };
}
const defTol = (a: number) => Math.max(0.01, 0.002 * Math.abs(a));

/** The shapes he names in Lesson 6. */
const SHAPES_6 = ["Symmetric", "Skewed right", "Skewed left", "Bimodal"];
type Shape6 = "Symmetric" | "Skewed right" | "Skewed left" | "Bimodal";
const PROFILE_8: Record<Shape6, number[]> = {
  Symmetric: [1, 3, 7, 10, 10, 7, 3, 1],
  "Skewed right": [4, 11, 9, 6, 4, 3, 2, 1],
  "Skewed left": [1, 2, 3, 4, 6, 9, 11, 4],
  Bimodal: [2, 8, 11, 3, 3, 11, 8, 2],
};
const WHY_SHAPE: Record<Shape6, string> = {
  Symmetric: "One peak in the middle and the two sides look alike: symmetric.",
  "Skewed right": "The peak is pushed to the left with a long tail to the right: right skewed (\"if pushed to the left it is right skewed\").",
  "Skewed left": "The peak is pushed to the right with a long tail to the left: left skewed (\"if pushed to the right it is left skewed\").",
  Bimodal: "Two separate peaks: bimodal.",
};

// ---------- Q1: Toolpak histogram bin counts ----------
const BIN_CTX = [
  { head: "Age (years)", story: "A gym recorded the age of every customer who joined in March.", a: 20, w: 5 },
  { head: "Minutes on site", story: "An online shop recorded how many minutes each visitor spent on its website.", a: 4, w: 2 },
  { head: "Daily sales (units)", story: "A bakery recorded how many loaves it sold each day.", a: 40, w: 10 },
  { head: "Score (out of 100)", story: "A class took a 100-point test.", a: 45, w: 5 },
  { head: "Delivery time (minutes)", story: "A courier recorded each delivery time in minutes.", a: 12, w: 4 },
];
const bins: BlockMaker = {
  key: "l6.bins",
  title: "Toolpak histogram: the frequency of each bin (and the shape)",
  make(rng): Block {
    const ctx = pick(rng, BIN_CTX);
    const shape = pick(rng, SHAPES_6) as Shape6;
    const mult = pick(rng, [1, 1.5, 2]);
    const k = 8;
    const lim = Array.from({ length: k }, (_, i) => ctx.a + i * ctx.w);
    const x: number[] = [];
    PROFILE_8[shape].forEach((p, i) => {
      const cnt = Math.max(0, Math.round(p * mult) + (p >= 3 ? int(rng, -1, 1) : 0));
      for (let j = 0; j < cnt; j++) x.push(j === 0 && cnt >= 2 ? lim[i] : int(rng, lim[i] - ctx.w + 1, lim[i]));
    });
    const more = shape === "Skewed right" ? int(rng, 0, 2) : 0;
    for (let j = 0; j < more; j++) x.push(int(rng, lim[k - 1] + 1, lim[k - 1] + ctx.w));
    // Shuffle so the data are not in bin order.
    for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
    const n = x.length, first = TOP + 1, last = TOP + n, R = `$B$${first}:$B$${last}`;
    const S = new Sheet();
    S.header(`B${TOP}`, ctx.head);
    x.forEach((v, i) => S.set(`B${first + i}`, v, "data"));
    S.header(`D${TOP}`, "Bin").header(`E${TOP}`, "Frequency");
    const r = TOP + 1;
    lim.forEach((u, i) => S.given(`D${r + i}`, u));
    S.label(`D${r + k}`, "More");
    const toolpak = (i: number) => x.filter((v) => (i === 0 ? true : v > lim[i - 1]) && v <= lim[i]).length;
    const halfOpen = (i: number) => x.filter((v) => (i === 0 ? true : v >= lim[i - 1]) && v < lim[i]).length;
    lim.forEach((u, i) => {
      const ans = toolpak(i);
      const f = i === 0 ? `=COUNTIF(${R},"<="&D${r})` : `=COUNTIFS(${R},">"&D${r + i - 1},${R},"<="&D${r + i})`;
      S.parts.push({
        label: `Frequency of bin ${u}`, cell: `E${r + i}`, answer: ans, formula: f, tol: 0,
        explain: i === 0
          ? `The Toolpak's first bin counts every value ≤ ${u}.`
          : `The Toolpak's bin ${u} counts values > ${lim[i - 1]} and ≤ ${u} (a value equal to ${u} belongs here, not in the next bin).`,
        traps: traps(ans, 0, [{ value: halfOpen(i), why: `Counted values equal to a bin limit in the next bin. The Toolpak puts a value equal to ${u} in bin ${u}.` }]),
      });
    });
    const moreAns = x.filter((v) => v > lim[k - 1]).length;
    S.parts.push({
      label: "Frequency of More", cell: `E${r + k}`, answer: moreAns, formula: `=COUNTIF(${R},">"&D${r + k - 1})`, tol: 0,
      explain: `The Toolpak's last row, More, counts values > ${lim[k - 1]}, the top bin.`,
      traps: traps(moreAns, 0, [{ value: x.filter((v) => v >= lim[k - 1]).length, why: `A value equal to ${lim[k - 1]} belongs in bin ${lim[k - 1]}, not in More.` }]),
    });
    S.ask(`D${r + k + 2}`, {
      label: "Shape of the histogram", cell: `E${r + k + 2}`, answer: shape, formula: `"${shape}"`, options: SHAPES_6,
      explain: `${WHY_SHAPE[shape]} (Lesson 6: symmetric if the histogram looks symmetric; two peaks is bimodal; a peak pushed to one side is skew.)`,
    });
    return {
      tab: "Toolpak bins", title: "Toolpak histogram frequencies",
      text: [
        `${ctx.story} The ${n} values are in column B and the bins (upper limits) are in column D.`,
        "Fill the Frequency column with exactly the counts the Data Analysis Toolpak's Histogram tool gives for these bins, using COUNTIF/COUNTIFS. Remember its rule: each bin counts the values ≤ its limit and > the previous limit; More counts values above the last bin.",
        `Then describe the shape: ${SHAPES_6.join(", ")}.`,
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Run Data > Data Analysis > Histogram with Input Range = column B and Bin Range = column D (tick Chart Output). Self-check: its Frequency column matches your answers.",
        "Tidy the chart as in class: a concise title, axis titles, no distracting features (set the gap width to 0 so the bars touch, and delete the legend).",
      ],
    };
  },
};

// ---------- Q2: outliers by the Z-score and IQR definitions ----------
const outliers: BlockMaker = {
  key: "l6.outliers",
  title: "Outliers: the IQR rule and extreme outliers (|z| > 3)",
  make(rng): Block {
    const sd = pick(rng, [7, 9, 11]);
    const scen = pick(rng, ["none", "mild", "high", "high", "low", "both"]);
    let x: number[] = [], n = 0, m = 0, s = 0;
    for (let tries = 0; tries < 60; tries++) {
      n = int(rng, 30, 45);
      x = Array.from({ length: n }, () => Math.max(20, Math.round(45 + sd * gauss(rng))));
      const put = (v: number) => { x[int(rng, 0, n - 1)] = v; };
      if (scen === "mild") put(Math.round(45 + sd * (2.6 + 0.5 * rng())));
      if (scen === "high" || scen === "both") put(pick(rng, [99, 104, 110, 120]));
      if (scen === "low" || scen === "both") put(pick(rng, [0, 2, 3, 4]));
      m = mean(x); s = Math.sqrt(varS(x));
      // The Yes/No judgements must not depend on QUARTILE.INC vs .EXC (both are accepted).
      const fi = fences(x, pctInc), fe = fences(x, pctExc);
      const mx = Math.max(...x), mn = Math.min(...x);
      const agree = (mx > fi.hi) === (mx > fe.hi) && (mn < fi.lo) === (mn < fe.lo);
      if (agree && x.every((v) => Math.abs(Math.abs(v - m) - 3 * s) > 1e-6 * s)) break;
    }
    const first = TOP + 1, last = TOP + n, R = `C${first}:C${last}`;
    const S = new Sheet();
    S.header(`B${TOP}`, "Guess #").header(`C${TOP}`, "Guessed age");
    x.forEach((v, i) => { S.set(`B${first + i}`, i + 1, "data"); S.set(`C${first + i}`, v, "data"); });
    S.header(`E${TOP}`, "Measure").header(`F${TOP}`, "Value");
    const r = TOP + 1;
    const { q1, q3, iqr, lo, hi } = fences(x, pctInc);
    const E = fences(x, pctExc);
    S.ask(`E${r}`, { label: "Mean", cell: `F${r}`, answer: m, formula: `=AVERAGE(${R})`, explain: "AVERAGE of the guesses." });
    S.ask(`E${r + 1}`, {
      label: "Std dev", cell: `F${r + 1}`, answer: s, formula: `=STDEV.S(${R})`, explain: "Sample standard deviation: STDEV.S, as in the notes.",
      traps: traps(s, defTol(s), [{ value: Math.sqrt(varP(x)), why: "STDEV.P is the population version; the notes use STDEV.S." }]),
    });
    S.ask(`E${r + 3}`, { label: "Q1", cell: `F${r + 3}`, answer: q1, formula: `=QUARTILE.INC(${R},1)`, explain: `First quartile: QUARTILE.INC(data, 1). ${EXC_OK}`, alts: altsFor(q1, E.q1, defTol(q1)) });
    S.ask(`E${r + 4}`, { label: "Q3", cell: `F${r + 4}`, answer: q3, formula: `=QUARTILE.INC(${R},3)`, explain: `Third quartile: QUARTILE.INC(data, 3). ${EXC_OK}`, alts: altsFor(q3, E.q3, defTol(q3)) });
    S.ask(`E${r + 5}`, { label: "IQR", cell: `F${r + 5}`, answer: iqr, formula: `=F${r + 4}-F${r + 3}`, explain: `IQR = Q3 − Q1 (quartiles from QUARTILE.INC or .EXC both count).`, alts: altsFor(iqr, E.iqr, defTol(iqr)) });
    S.ask(`E${r + 6}`, {
      label: "Lower limit Q1 − 1.5·IQR", cell: `F${r + 6}`, answer: lo, formula: `=F${r + 3}-1.5*F${r + 5}`,
      explain: "Below Q1 − 1.5·IQR is an outlier (definition 2 in the notes). Quartiles from QUARTILE.INC or .EXC both count.",
      alts: altsFor(lo, E.lo, defTol(lo)),
      traps: traps(lo, defTol(lo), [{ value: q1 - iqr, why: "Forgot the 1.5." }], altsFor(lo, E.lo, defTol(lo))),
    });
    S.ask(`E${r + 7}`, {
      label: "Upper limit Q3 + 1.5·IQR", cell: `F${r + 7}`, answer: hi, formula: `=F${r + 4}+1.5*F${r + 5}`,
      explain: "Above Q3 + 1.5·IQR is an outlier (definition 2 in the notes). Quartiles from QUARTILE.INC or .EXC both count.",
      alts: altsFor(hi, E.hi, defTol(hi)),
      traps: traps(hi, defTol(hi), [{ value: q3 + iqr, why: "Forgot the 1.5." }], altsFor(hi, E.hi, defTol(hi))),
    });
    const nIqr = x.filter((v) => v > hi || v < lo).length;
    const nIqrAlts = altsFor(nIqr, x.filter((v) => v > E.hi || v < E.lo).length, 0);
    const nExt = x.filter((v) => Math.abs((v - m) / s) > 3).length;
    const nZ2 = x.filter((v) => Math.abs((v - m) / s) > 2).length;
    S.ask(`E${r + 9}`, {
      label: "Number of outliers by the IQR rule", cell: `F${r + 9}`, answer: nIqr, tol: 0,
      formula: `=COUNTIF(${R},">"&F${r + 7})+COUNTIF(${R},"<"&F${r + 6})`,
      explain: "Count the values above the upper limit plus the values below the lower limit (with limits from QUARTILE.INC or .EXC: both count).",
      alts: nIqrAlts,
      traps: traps(nIqr, 0, [{ value: x.filter((v) => v > hi).length, why: "Counted only the high side; outliers can be on both sides." }, { value: x.filter((v) => v < lo).length, why: "Counted only the low side; outliers can be on both sides." }], nIqrAlts),
    });
    S.ask(`E${r + 10}`, {
      label: "Number of extreme outliers (|z| > 3)", cell: `F${r + 10}`, answer: nExt, tol: 0,
      formula: `=COUNTIF(${R},">"&(F${r}+3*F${r + 1}))+COUNTIF(${R},"<"&(F${r}-3*F${r + 1}))`,
      explain: "An extreme outlier has Z-score > 3 or < −3, i.e. it is above x̄ + 3S or below x̄ − 3S. (With a Z-score column: =COUNTIF(z,\">3\")+COUNTIF(z,\"<-3\").)",
      traps: traps(nExt, 0, [{ value: nZ2, why: "That counts |z| > 2. Extreme outliers need |z| > 3." }]),
    });
    const target = scen === "low" ? "smallest" : scen === "both" ? pick(rng, ["largest", "smallest"]) : pick(rng, ["largest", "largest", "smallest"]);
    const tv = target === "largest" ? Math.max(...x) : Math.min(...x);
    const fn = target === "largest" ? "MAX" : "MIN";
    const isIqr = target === "largest" ? tv > hi : tv < lo;
    const isExt = Math.abs((tv - m) / s) > 3;
    S.ask(`E${r + 12}`, {
      label: `Is the ${target} guess an outlier by the IQR rule?`, cell: `F${r + 12}`, answer: isIqr ? "Yes" : "No", options: ["Yes", "No"],
      formula: target === "largest" ? `=IF(MAX(${R})>F${r + 7},"Yes","No")` : `=IF(MIN(${R})<F${r + 6},"Yes","No")`,
      explain: `The ${target} guess is ${tv}; the ${target === "largest" ? "upper" : "lower"} limit is ${+(target === "largest" ? hi : lo).toFixed(4)}, so it is ${isIqr ? "" : "not "}an outlier by Q${target === "largest" ? "3 + " : "1 − "}1.5·IQR.`,
    });
    S.ask(`E${r + 13}`, {
      label: `Is the ${target} guess an extreme outlier (|z| > 3)?`, cell: `F${r + 13}`, answer: isExt ? "Yes" : "No", options: ["Yes", "No"],
      formula: `=IF(ABS((${fn}(${R})-F${r})/F${r + 1})>3,"Yes","No")`,
      explain: `Its Z-score is (${tv} − x̄)/S = ${((tv - m) / s).toFixed(3)}, so it is ${isExt ? "" : "not "}an extreme outlier. The two definitions need not agree: outliers are subjective.`,
    });
    return {
      tab: "Outliers", title: "How old is the professor? Outliers",
      text: [
        `${n} students guessed their professor's age (column C), as in the "How old is Dr Phil" sheet. Some guesses may be typos or jokes.`,
        "Find the mean, standard deviation, quartiles and IQR, then use the notes' two definitions: an extreme outlier has a Z-score > 3 or < −3; an outlier (IQR rule) is more than Q3 + 1.5·IQR or less than Q1 − 1.5·IQR.",
        "Use STDEV.S, and QUARTILE.INC (QUARTILE.EXC answers are accepted too).",
      ],
      cells: S.cells, parts: S.parts,
      manual: ["Add a Z-score column D with =(C9-$F$9)/$F$10 filled down, and a boxplot of column C. Self-check: points drawn beyond the boxplot's whiskers are your IQR-rule outliers (Excel's quartiles can differ slightly from QUARTILE.INC)."],
    };
  },
};

// ---------- Q3: the "Histograms" sheet table of measures ----------
const describe: BlockMaker = {
  key: "l6.describe",
  title: "The table of numerical descriptive measures and Z-scores (Histograms sheet)",
  make(rng): Block {
    const kind = pick(rng, ["sym", "right", "left"]);
    const n = int(rng, 24, 32);
    const gen = () => {
      const g = kind === "sym" ? 5.5 + 1.7 * gauss(rng) : kind === "right" ? 2 + 1.6 * (-Math.log(1 - rng()) - Math.log(1 - rng())) : 9 - 1.6 * (-Math.log(1 - rng()) - Math.log(1 - rng()));
      return Math.min(10, Math.max(1, Math.round(g)));
    };
    let x = Array.from({ length: n }, gen);
    x = forceMode(rng, x);
    const first = TOP + 1, last = TOP + n, R = `B${first}:B${last}`;
    const S = new Sheet();
    S.header(`B${TOP}`, "Value").header(`C${TOP}`, "Z-score");
    x.forEach((v, i) => S.set(`B${first + i}`, v, "data"));
    S.header(`E${TOP}`, "Numerical descriptive measure").header(`F${TOP}`, "Value");
    S.header(`H${TOP}`, "Bins");
    for (let b = 1; b <= 10; b++) S.given(`H${TOP + b}`, b);
    const m = mean(x), v = varS(x), s = Math.sqrt(v), md = median(x), mo = modeOf(x);
    const mn = Math.min(...x), mx = Math.max(...x), q1 = pctInc(x, 0.25), q2 = md, q3 = pctInc(x, 0.75);
    const q1e = pctExc(x, 0.25), q3e = pctExc(x, 0.75);
    const r = TOP + 1;
    S.ask(`E${r}`, { label: "Mean", cell: `F${r}`, answer: m, formula: `=AVERAGE(${R})`, explain: "AVERAGE." });
    S.ask(`E${r + 1}`, {
      label: "Variance", cell: `F${r + 1}`, answer: v, formula: `=VAR.S(${R})`, explain: "Sample variance: VAR.S.",
      traps: traps(v, defTol(v), [{ value: varP(x), why: "VAR.P is the population variance; use VAR.S." }]),
    });
    S.ask(`E${r + 2}`, { label: "Median", cell: `F${r + 2}`, answer: md, formula: `=MEDIAN(${R})`, explain: "MEDIAN: half the data above, half below." });
    S.ask(`E${r + 3}`, { label: "Mode", cell: `F${r + 3}`, answer: mo, formula: `=MODE.SNGL(${R})`, tol: 0, explain: "MODE.SNGL: the most common value (the tallest bar of a histogram with bins 1, 2, …, 10)." });
    S.ask(`E${r + 4}`, { label: "Range", cell: `F${r + 4}`, answer: mx - mn, formula: `=F${r + 8}-F${r + 7}`, explain: "Range = maximum − minimum." });
    S.ask(`E${r + 5}`, {
      label: "Standard deviation", cell: `F${r + 5}`, answer: s, formula: `=STDEV.S(${R})`, explain: "Sample standard deviation: STDEV.S, as in his cell F8.",
      traps: traps(s, defTol(s), [{ value: Math.sqrt(varP(x)), why: "STDEV.P is the population version; the notes use STDEV.S." }]),
    });
    S.ask(`E${r + 6}`, { label: "IQR", cell: `F${r + 6}`, answer: q3 - q1, formula: `=F${r + 11}-F${r + 9}`, explain: "IQR = Q3 − Q1 (quartiles from QUARTILE.INC or .EXC both count).", alts: altsFor(q3 - q1, q3e - q1e, defTol(q3 - q1)) });
    S.ask(`E${r + 7}`, { label: "Minimum", cell: `F${r + 7}`, answer: mn, formula: `=MIN(${R})`, explain: "MIN." });
    S.ask(`E${r + 8}`, { label: "Maximum", cell: `F${r + 8}`, answer: mx, formula: `=MAX(${R})`, explain: "MAX." });
    S.ask(`E${r + 9}`, { label: "Q1", cell: `F${r + 9}`, answer: q1, formula: `=QUARTILE.INC(${R},1)`, explain: `QUARTILE.INC(data, 1). ${EXC_OK}`, alts: altsFor(q1, q1e, defTol(q1)) });
    S.ask(`E${r + 10}`, { label: "Q2", cell: `F${r + 10}`, answer: q2, formula: `=QUARTILE.INC(${R},2)`, explain: `QUARTILE.INC(data, 2), the median (QUARTILE.EXC(data, 2) gives the same).`, alts: altsFor(q2, pctExc(x, 0.5), defTol(q2)) });
    S.ask(`E${r + 11}`, { label: "Q3", cell: `F${r + 11}`, answer: q3, formula: `=QUARTILE.INC(${R},3)`, explain: `QUARTILE.INC(data, 3). ${EXC_OK}`, alts: altsFor(q3, q3e, defTol(q3)) });
    const z1 = (x[0] - m) / s, zMax = (mx - m) / s;
    S.ask(`E${r + 13}`, {
      label: `Z-score of the first value (B${first})`, cell: `F${r + 13}`, answer: z1, formula: `=(B${first}-F${r})/F${r + 5}`, tol: 0.001,
      explain: "Z = (Xᵢ − x̄)/S. In column C he writes =(B9-$F$9)/($F$14) and fills down.",
      traps: traps(z1, 0.001, [{ value: (x[0] - m) / v, why: "Divided by the variance; divide by the standard deviation." }, { value: (x[0] - m) / Math.sqrt(varP(x)), why: "Used the population standard deviation." }]),
    });
    S.ask(`E${r + 14}`, {
      label: "Z-score of the maximum", cell: `F${r + 14}`, answer: zMax, formula: `=(F${r + 8}-F${r})/F${r + 5}`, tol: 0.001,
      explain: "Z of the largest value = (max − x̄)/S.",
      traps: traps(zMax, 0.001, [{ value: (mx - m) / v, why: "Divided by the variance; divide by the standard deviation." }]),
    });
    return {
      tab: "Descriptive table", title: "Numerical descriptive measures and Z-scores",
      text: [
        `Here are ${n} whole-number scores (column B), like the data on the Lesson 6 "Histograms" sheet.`,
        "Fill his table of numerical descriptive measures with formulas (sample measures: VAR.S, STDEV.S; quartiles with QUARTILE.INC, though QUARTILE.EXC is accepted too), then two Z-scores.",
        "Column C is for your own Z-score column and column H holds bins 1 to 10 for a Toolpak histogram (neither is marked).",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Fill column C with =(B9-$F$9)/$F$14 and drag it down. Self-check: the Z-score of the maximum matches your answer.",
        "Make a Toolpak histogram of column B with the bins in column H. Self-check: the tallest bar is at your mode, and describe the shape (symmetric, skewed, bimodal).",
      ],
    };
  },
};

export const LESSON_06: Lesson = {
  n: 6,
  title: "Histograms",
  unit: 1,
  week: "Week 4 · Mon 21 Sep · Histograms",
  sources: ["Lesson 6, notes.xlsx"],
  summary:
    "A histogram shows how a data set is distributed: you choose bins, the Data Analysis Toolpak counts how many values fall in each, and the picture tells you whether the data are symmetric, skewed or bimodal. Alongside it, outliers are judged with Z-scores or the IQR rule, and the notes stress that the definitions are a choice.",
  defs: [
    { term: "Outliers", text: "Outliers are subjective. There are some common definitions.", source: "Lesson 6, notes › age G12" },
    { term: "Extreme outlier", text: "An \"extreme outlier\" is one whose Z-score is > 3 or < −3.", source: "Lesson 6, notes › age H13" },
    { term: "Outlier (IQR rule)", text: "An outlier is more than Q3 + 1.5·IQR or less than Q1 − 1.5·IQR.", source: "Lesson 6, notes › age H14" },
    { term: "Z-score", text: "(Xᵢ − x̄)/S. In Excel: =(B3-$F$3)/($F$8) filled down, where F3 = AVERAGE and F8 = STDEV.S of the data.", source: "Lesson 6, notes › Histograms H10, C3, F3, F8" },
    { term: "Numerical descriptive measures", text: "His table: Mean, Variance, Median, Mode, Range, Standard deviation, IQR, Z-scores, Minimum, Maximum, Q1, Q2, Q3, with Definition and Excel formula columns to fill in (blank in his file apart from the Z-score, (Xi − X̄)/S).", source: "Lesson 6, notes › Histograms G2–I15" },
    { term: "Bins (Toolpak histogram)", text: "You list the bins (upper limits) in a column; the Toolpak's Histogram tool returns a Bin/Frequency table. Each bin counts the values ≤ its limit and > the previous limit (on his sheet the two 2s are counted in bin 2). The Toolpak also adds a final row, More, for anything above the last bin (his pasted output stops at bin 10).", source: "Lesson 6, notes › Histograms F33–I43 (key fact from his output)" },
    { term: "Symmetric", text: "Data is described as being symmetric if the histogram looks symmetric.", source: "Lesson 6, notes › Histograms F49" },
    { term: "Mode (of a histogram) and bimodal", text: "The mode is the tallest peak in the histogram. If the histogram has two peaks then it is called bimodal.", source: "Lesson 6, notes › Histograms F51–G52" },
    { term: "Skew", text: "If a histogram has a peak which is pushed to a side it is skew. If pushed to the right/left it is left/right skewed.", source: "Lesson 6, notes › Histograms F54–G55" },
  ],
  examples: [
    {
      title: "The Histograms sheet: measures, Z-scores and a Toolpak histogram",
      setup: "28 whole numbers are in B3:B30. Find the mean and standard deviation, the Z-scores, and a Toolpak histogram with bins 1 to 10.",
      table: { head: ["Bin", "Frequency"], rows: [[1, 0], [2, 2], [3, 5], [4, 8], [5, 6], [6, 4], [7, 1], [8, 1], [9, 1], [10, 0]] },
      steps: [
        { say: "Mean", formula: "=AVERAGE(B3:B30)", result: "4.6071" },
        { say: "Standard deviation (sample)", formula: "=STDEV.S(B3:B30)", result: "1.6631" },
        { say: "Z-score of the first value, 5 (fill down)", formula: "=(B3-$F$3)/($F$8)", result: "0.2362" },
        { say: "Z-score of the largest value, 9", formula: "=(B22-$F$3)/($F$8)", result: "2.6414" },
        { say: "Toolpak: Data > Data Analysis > Histogram, Input Range B3:B30, Bin Range F34:F43", result: "the Bin/Frequency table above" },
        { say: "Check bin 4 with COUNTIFS (values > 3 and ≤ 4)", formula: "=COUNTIFS(B3:B30,\">\"&F36,B3:B30,\"<=\"&F37)", result: "8" },
        { say: "Check bin 1 (everything ≤ 1)", formula: "=COUNTIF(B3:B30,\"<=\"&F34)", result: "0" },
        { say: "Quartiles", formula: "=QUARTILE.INC(B3:B30,1)  and  =QUARTILE.INC(B3:B30,3)", result: "3.75 and 5.25, so IQR = 1.5" },
        { say: "IQR-rule limits", formula: "=3.75-1.5*1.5  and  =5.25+1.5*1.5", result: "1.5 and 7.5: the 8 and the 9 are outliers by the IQR rule (with QUARTILE.EXC the limits are −0.5 and 9.5 and nothing is flagged), but no Z-score is above 3, so there are no extreme outliers" },
      ],
      takeaway: "The tallest bar (bin 4, frequency 8) is the mode; the two outlier definitions can disagree.",
      source: "Lesson 6, notes › Histograms",
    },
    {
      title: "How old is Dr Phil? Outliers are subjective",
      setup: "Students guessed the professor's age (C3:C97, 93 guesses). One guess is 99 and one is 3.141592653589 (π).",
      steps: [
        { say: "Mean", formula: "=AVERAGE(C3:C97)", result: "46.356" },
        { say: "Standard deviation", formula: "=STDEV.S(C3:C97)", result: "18.230" },
        { say: "Max and min", formula: "=MAX(C3:C97)  and  =MIN(C3:C97)", result: "99 and 3.1416" },
        { say: "Z-score of the 99 guess", formula: "=(C3-$H$4)/$H$5", result: "2.888" },
        { say: "Z-score of the π guess", formula: "=(C86-$H$4)/$H$5", result: "−2.371" },
        { say: "Quartiles and IQR (QUARTILE.INC)", result: "Q1 = 35, Q3 = 61, IQR = 26" },
        { say: "IQR-rule limits", result: "35 − 39 = −4 and 61 + 39 = 100" },
      ],
      takeaway: "Neither 99 nor π is an extreme outlier (|z| < 3) or an IQR-rule outlier (inside −4 to 100), yet π is clearly not a real guess: the rules are only guides, and judgement decides what to remove.",
      source: "Lesson 6, notes › age (computed from his data; the notes list the definitions and \"Remove Outliers\" without the results)",
    },
  ],
  quiz: [
    { q: "By the notes' first definition, an extreme outlier is a value whose Z-score is…", options: ["> 2 or < −2", "> 3 or < −3", "> 1.5 or < −1.5", "above Q3"], answer: 1, why: "\"An extreme outlier is one whose Z-score is > 3 or < −3.\"" },
    { q: "Q1 = 10 and Q3 = 18. By the IQR rule, which value is an outlier?", options: ["29", "31", "−1", "20"], answer: 1, why: "IQR = 8, so the limits are 10 − 12 = −2 and 18 + 12 = 30. Only 31 is outside." },
    { q: "Your Toolpak bins are 10, 20, 30, 40. Which values does the bin labelled 30 count?", options: ["20 ≤ x < 30", "20 < x ≤ 30", "25 ≤ x ≤ 35", "x ≤ 30"], answer: 1, why: "Each Toolpak bin counts values above the previous limit and up to and including its own limit." },
    { q: "A data value is exactly 20 and the bins are 10, 20, 30. Where does the Toolpak count it?", options: ["Bin 10", "Bin 20", "Bin 30", "More"], answer: 1, why: "A value equal to a limit goes in that limit's bin." },
    { q: "A histogram's peak is near the left with a long tail to the right. It is…", options: ["Left skewed", "Right skewed", "Symmetric", "Bimodal"], answer: 1, why: "\"If pushed to the right/left it is left/right skewed\": a peak pushed to the left is right skewed." },
    { q: "A histogram has two clear peaks. It is called…", options: ["Skewed", "Uniform", "Bimodal", "Symmetric"], answer: 2, why: "\"If the histogram has two peaks then it is called bimodal.\"" },
    { q: "In a histogram, the mode is…", options: ["The middle bin", "The tallest peak", "The widest bin", "The last bin"], answer: 1, why: "\"The mode is the tallest peak in the histogram.\"" },
    { q: "In the age guesses, 99 has Z-score 2.89 and lies inside the IQR limits (−4 to 100). What does that show?", options: ["99 must be kept because it is real", "Outliers are subjective: the definitions are guides and can miss suspicious values", "The Z-score was computed wrongly", "99 is an extreme outlier"], answer: 1, why: "Neither rule flags it as extreme, which is why the notes begin: \"Outliers are subjective. There are some common definitions.\"" },
    { q: "His Z-score formula is =(B3-$F$3)/($F$8). Why the $ signs?", options: ["To round the answer", "So the mean and standard deviation cells stay fixed when the formula is filled down", "To make the answer positive", "Excel requires them in every formula"], answer: 1, why: "Absolute references keep F3 (mean) and F8 (standard deviation) fixed while B3 moves down the column." },
  ],
  excel: [
    { fn: "Data Analysis Toolpak: Histogram", use: "Data > Data Analysis > Histogram: Input Range = the data, Bin Range = your column of bin upper limits, tick Chart Output. It returns Bin/Frequency (plus More) and a chart." },
    { fn: "COUNTIF / COUNTIFS (checking bins)", use: "First bin: =COUNTIF(data,\"<=\"&bin1). Others: =COUNTIFS(data,\">\"&previous,data,\"<=\"&bin). More: =COUNTIF(data,\">\"&lastbin)." },
    { fn: "AVERAGE, STDEV.S", use: "The mean (F3) and standard deviation (F8) used in the Z-scores." },
    { fn: "Z-score", use: "=(B3-$F$3)/($F$8) filled down; extreme outliers are |z| > 3." },
    { fn: "QUARTILE.INC (or QUARTILE.EXC)", use: "Q1 and Q3 for the IQR rule: limits Q1 − 1.5·IQR and Q3 + 1.5·IQR. He has used both functions (.EXC on the Fall 2026 Exam 1 key); this site accepts either." },
    { fn: "MAX, MIN", use: "First check for impossible values (in the age sheet, MAX = 99 and MIN = π)." },
  ],
  watch: [
    "Fall 2026 Exam 1 Section 2 (Random variables): \"Use the Data Analysis Toolpak to produce a histogram of total tip amounts … describe the shape\" (4 points). His key used bins 0, 1, 2, … and wrote \"Unimodal, right (positive) skew.\" Positive skew means right skew.",
    "Spring 2026 Exam 1 Excel skills Q9: a boxplot and a histogram \"with bins of width $5\"; Fall 2025 Exam 1 Q2(f): a histogram of speedrun times \"so that they have width 1\". Build the bin column first (start, start + width, … past the max).",
    "Spring 2026 Exam 1 quick questions 5–6: pick the adjectives for a pictured histogram from positive skew, negative skew, symmetric, bimodal (Q5's answer: negative skew).",
    "Midterm 1 announcement (Spring 2026): \"Know how to produce professional looking histograms using the Data Analysis Toolpak.\" Give the chart a concise title and axis titles, and avoid distracting features (Lesson 3's chart rules).",
    "Quartiles: Homework 3 uses QUARTILE.INC but his Fall 2026 Exam 1 key used QUARTILE.EXC. This site accepts either for Q1, Q3, the IQR, the IQR-rule limits and the outlier count.",
    "Common slips: a value equal to a bin limit belongs in that bin (≤), not the next; forgetting the More row; mixing up the direction of skew (the tail's side names the skew, not the peak's); using |z| > 2 when the question says extreme outlier (|z| > 3).",
  ],
  makers: [bins, outliers, describe],
};
