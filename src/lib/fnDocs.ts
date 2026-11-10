// Function help for the practice sheet: the autocomplete list and the argument ScreenTip,
// worded the way Excel shows them, with a plain note on each argument for AQM 1000.
import { SUPPORTED_FUNCTIONS } from "./excel.ts";

export type FnArg = { name: string; help: string; optional?: boolean };
export type FnDoc = { name: string; summary: string; args: FnArg[]; variadic?: boolean; inClass: boolean };

const DOCS: FnDoc[] = [
  { name: "NORM.DIST", inClass: true, summary: "Area to the left of x under a normal curve with this mean and standard deviation",
    args: [
      { name: "x", help: "the value you want the area to the left of" },
      { name: "mean", help: "the mean μ of the distribution" },
      { name: "standard_dev", help: "the standard deviation σ (or σ/√n for a sample mean)" },
      { name: "cumulative", help: "TRUE = area to the left (a probability). FALSE = height of the curve, almost never what you want" },
    ] },
  { name: "NORM.S.DIST", inClass: true, summary: "Area to the left of z under the standard normal N(0, 1)",
    args: [
      { name: "z", help: "the z-score, e.g. your Z-statistic" },
      { name: "cumulative", help: "TRUE = area to the left (a probability)" },
    ] },
  { name: "NORM.INV", inClass: true, summary: "The value with this much area to its left (a percentile)",
    args: [
      { name: "probability", help: "area to the LEFT of the answer: top 10% → 0.9" },
      { name: "mean", help: "the mean μ" },
      { name: "standard_dev", help: "the standard deviation σ" },
    ] },
  { name: "NORM.S.INV", inClass: true, summary: "The z-score with this much area to its left",
    args: [{ name: "probability", help: "area to the left: Z_α/2 uses 1-α/2, e.g. 0.975 for 95%" }] },
  { name: "T.DIST", inClass: true, summary: "Area to the left of t under a t-distribution",
    args: [
      { name: "x", help: "the t-value, e.g. your T-statistic" },
      { name: "deg_freedom", help: "degrees of freedom ν = n − 1" },
      { name: "cumulative", help: "TRUE = area to the left (a probability)" },
    ] },
  { name: "T.INV", inClass: true, summary: "The t-value with this much area to its left",
    args: [
      { name: "probability", help: "area to the left: T_α/2 uses 1-α/2; a left-tail critical value uses α" },
      { name: "deg_freedom", help: "degrees of freedom ν = n − 1" },
    ] },
  { name: "AVERAGE", inClass: true, summary: "The mean of the numbers: x̄", variadic: true,
    args: [{ name: "number1", help: "a range like D5:D14, or numbers" }, { name: "number2", help: "more numbers or ranges", optional: true }] },
  { name: "STDEV.S", inClass: true, summary: "Sample standard deviation s (divides by n − 1)", variadic: true,
    args: [{ name: "number1", help: "a range like D5:D14" }, { name: "number2", help: "more numbers or ranges", optional: true }] },
  { name: "COUNT", inClass: true, summary: "How many numbers there are: n", variadic: true,
    args: [{ name: "value1", help: "a range like D5:D14" }, { name: "value2", help: "more ranges", optional: true }] },
  { name: "SQRT", inClass: true, summary: "Square root, e.g. SQRT(n) in σ/√n",
    args: [{ name: "number", help: "the number to take the square root of" }] },
  { name: "SUM", inClass: false, summary: "Adds the numbers", variadic: true,
    args: [{ name: "number1", help: "a range or numbers" }, { name: "number2", help: "more", optional: true }] },
  { name: "MIN", inClass: false, summary: "The smallest number", variadic: true, args: [{ name: "number1", help: "a range or numbers" }, { name: "number2", help: "more", optional: true }] },
  { name: "MAX", inClass: false, summary: "The largest number", variadic: true, args: [{ name: "number1", help: "a range or numbers" }, { name: "number2", help: "more", optional: true }] },
  { name: "ROUND", inClass: false, summary: "Rounds to a number of digits",
    args: [{ name: "number", help: "the number to round" }, { name: "num_digits", help: "how many decimal places" }] },
  { name: "POWER", inClass: false, summary: "A number raised to a power", args: [{ name: "number", help: "the base" }, { name: "power", help: "the exponent" }] },
  { name: "ABS", inClass: false, summary: "Absolute value. Class uses the sign rule instead", args: [{ name: "number", help: "the number" }] },
  { name: "EXP", inClass: false, summary: "e raised to a power", args: [{ name: "number", help: "the exponent" }] },
  { name: "LN", inClass: false, summary: "Natural logarithm", args: [{ name: "number", help: "a positive number" }] },
  { name: "VAR.S", inClass: false, summary: "Sample variance s²", variadic: true, args: [{ name: "number1", help: "a range" }, { name: "number2", help: "more", optional: true }] },
  { name: "STDEV.P", inClass: false, summary: "Population standard deviation (divides by n). Use STDEV.S for samples", variadic: true, args: [{ name: "number1", help: "a range" }, { name: "number2", help: "more", optional: true }] },
  { name: "T.DIST.2T", inClass: false, summary: "Two-tailed t probability. Class uses 2*T.DIST with the sign rule", args: [{ name: "x", help: "a non-negative t" }, { name: "deg_freedom", help: "ν = n − 1" }] },
  { name: "T.DIST.RT", inClass: false, summary: "Right-tail t probability. Class uses 1-T.DIST", args: [{ name: "x", help: "the t-value" }, { name: "deg_freedom", help: "ν = n − 1" }] },
  { name: "T.INV.2T", inClass: false, summary: "Two-tailed t critical value. Class uses T.INV(1-α/2, ν)", args: [{ name: "probability", help: "α" }, { name: "deg_freedom", help: "ν = n − 1" }] },
];

/** Only functions the sheet can really calculate, class functions first. */
export const FN_DOCS: FnDoc[] = DOCS.filter((d) => SUPPORTED_FUNCTIONS.includes(d.name));
// Logical values: suggested like Excel does, inserted without a parenthesis.
const LOGICALS: FnDoc[] = [
  { name: "TRUE", inClass: true, summary: "Logical TRUE: for .DIST, the area to the left", args: [] },
  { name: "FALSE", inClass: true, summary: "Logical FALSE: for .DIST, the height of the curve", args: [] },
];
const byName = new Map(FN_DOCS.map((d) => [d.name, d]));
export const fnDoc = (name: string) => byName.get(name.toUpperCase());

export type FormulaHelp =
  | { kind: "suggest"; prefix: string; start: number; items: FnDoc[] }
  | { kind: "args"; doc: FnDoc; argIndex: number }
  | null;

/**
 * What to show while the caret is at `caret` in `text`:
 * a list of functions matching the word being typed, or the argument tip of the function the caret is inside.
 */
export function formulaHelp(text: string, caret: number): FormulaHelp {
  if (!text.trimStart().startsWith("=")) return null;
  const before = text.slice(0, caret);

  // 1. Typing a function name right after =, (, an operator or a comma.
  const m = /(?:^\s*=|[=(,+\-*/^&<>\s])([A-Za-z][A-Za-z0-9.]*)$/.exec(before);
  if (m) {
    const prefix = m[1];
    const isCellRef = /^[A-Za-z]{1,2}\d+$/.test(prefix);
    const upper = prefix.toUpperCase();
    const items = isCellRef ? [] : [...LOGICALS, ...FN_DOCS].filter((d) => d.name.startsWith(upper) && d.name !== upper)
      .sort((a, b) => Number(b.inClass) - Number(a.inClass));
    if (items.length) return { kind: "suggest", prefix, start: caret - prefix.length, items: items.slice(0, 8) };
  }

  // 2. Inside a function call: which function, which argument.
  const stack: { name: string; arg: number }[] = [];
  let i = 0;
  while (i < before.length) {
    const ch = before[i];
    if (ch === "(") {
      const nm = /([A-Za-z][A-Za-z0-9.]*)\s*$/.exec(before.slice(0, i));
      stack.push({ name: nm ? nm[1] : "", arg: 0 });
    } else if (ch === ")") stack.pop();
    else if (ch === "," && stack.length) stack[stack.length - 1].arg++;
    i++;
  }
  for (let k = stack.length - 1; k >= 0; k--) {
    const doc = stack[k].name ? fnDoc(stack[k].name) : undefined;
    if (doc) return { kind: "args", doc, argIndex: stack[k].arg };
  }
  return null;
}
