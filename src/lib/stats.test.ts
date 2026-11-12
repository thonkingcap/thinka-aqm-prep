import { normCdf, normInv, tCdf, tInv, normDist, normInvGeneral, chisqCdf, chisqInv } from "./stats.ts";
import { readFileSync } from "node:fs";
// Reference values generated with SciPy (scripts/ref.py -> src/lib/stats.ref.json).
const ref = JSON.parse(readFileSync(new URL("./stats.ref.json", import.meta.url), "utf8"));
let worst = 0, fails = 0;
function check(name: string, got: number, want: number, tol = 1e-9) {
  const err = Math.abs(got - want) / Math.max(1, Math.abs(want));
  worst = Math.max(worst, err);
  if (!(err <= tol)) { fails++; console.log(`FAIL ${name}: got ${got}, want ${want}, err ${err}`); }
}
for (const [z, v] of ref.normCdf) check(`normCdf(${z})`, normCdf(z), v);
for (const [p, v] of ref.normInv) check(`normInv(${p})`, normInv(p), v);
for (const [t, df, v] of ref.tCdf) check(`tCdf(${t},${df})`, tCdf(t, df), v);
for (const [p, df, v] of ref.tInv) check(`tInv(${p},${df})`, tInv(p, df), v, 1e-8);
// Class examples (Lesson 12 Normal sheet): NORM.INV(0.9,18,5), NORM.DIST(15,18,5,TRUE)
check("NORM.INV(0.9,18,5)", normInvGeneral(0.9, 18, 5), ref.class.normInv_09_18_5);
check("NORM.DIST(15,18,5)", normDist(15, 18, 5), ref.class.normDist_15_18_5);
console.log(`${fails === 0 ? "PASS" : "FAILED"}: worst relative error ${worst.toExponential(2)}, ${fails} failures`);
if (fails) process.exit(1);

// Excel formula evaluator, checked against the class sheets.
import { evaluate } from "./excel.ts";
const ex = (f: string, want: number, tol = 1e-9) => check(f, evaluate(f), want, tol);
ex("=2*NORM.S.DIST((AVERAGE(80,80,83,80,79,79,80,81)-100)/(15/SQRT(8)),TRUE)", 0.00019601655399603674); // Lesson 16
ex("=2*_xlfn.T.DIST(-0.7238803109147864,31,TRUE)", 0.47456685897916584); // Lesson 16 trivia
ex("=_xlfn.T.INV(0.05/2,93-1)", -1.9860863169511298); // Lesson 16 critical values
ex("=T.INV(1-0.1/2,7-1)", 1.9431802805153022); // Lesson 15
ex("=STDEV.S(5,4,5,5,3,3,1)", 1.4960264830861913);
ex("=NORM.S.INV(1-10%/2)", 1.6448536269514715);
ex("=T.DIST.2T(ABS(-2.5),9)", 2 * (1 - tCdf(2.5, 9)));
ex("=-2^2", 4); // Excel: unary minus binds tighter than ^
ex("=1-NORM.DIST(300,250,150,TRUE)", 1 - normDist(300, 250, 150));
let threw = false; try { evaluate("T.DIST.2T(-1,5)"); } catch { threw = true; }
if (!threw) { fails++; console.log("FAIL T.DIST.2T negative should be #NUM!"); }
console.log(`${fails === 0 ? "PASS" : "FAILED"}: evaluator checks done, ${fails} failures`);
if (fails) process.exit(1);

// 12-case engine against the class sheets.
import { runTest } from "./tests12.ts";
const l16 = runTest({ h0: "eq", sigma: "known", xbar: 80.25, mu0: 100, sd: 15, n: 8, alpha: 0.01 });
check("L16 Z", l16.stat, -3.7240957142491506);
check("L16 p", l16.pValue, 0.00019601655399603674);
if (!l16.reject) { fails++; console.log("FAIL L16 should reject"); }
check("L16 p formula", evaluate(l16.excel.p), l16.pValue, 1e-3);
const phil = runTest({ h0: "eq", sigma: "unknown", xbar: 46.35636121132892, mu0: 34, sd: 18.229524756549367, n: 93, alpha: 0.05 });
check("Phil T", phil.stat, 6.536672447038142);
check("Phil crit", phil.crit[0], -1.9860863169511298);
const left = runTest({ h0: "ge", sigma: "unknown", xbar: 48, mu0: 50, sd: 6, n: 25, alpha: 0.05 });
check("left p = T.DIST", left.pValue, tCdf(left.stat, 24));
check("left crit = T.INV(α)", left.crit[0], tInv(0.05, 24));
if ((left.pValue < 0.05) !== left.reject) { fails++; console.log("FAIL p and crit disagree"); }
console.log(`${fails === 0 ? "PASS" : "FAILED"}: 12-case engine, ${fails} failures`);
if (fails) process.exit(1);

// Cell references and ranges, as in the practice sheet.
const cells: Record<string, number | string> = { B5: 18, B6: 5, B7: 15, D5: 10.1, D6: 9.8, D7: 9.7, D8: 9.1, D9: 10.2, A1: "label" };
const ctx = { get: (a: string) => (a in cells ? cells[a] : null) };
check("ref NORM.DIST", evaluate("=NORM.DIST(B7,B5,B6,TRUE)", ctx), normDist(15, 18, 5));
check("abs ref", evaluate("=NORM.DIST($B$7,$B$5,B6,TRUE)", ctx), normDist(15, 18, 5));
check("range AVERAGE", evaluate("=AVERAGE(D5:D9)", ctx), 9.78);
check("range STDEV.S", evaluate("=STDEV.S(D5:D9)", ctx), evaluate("=STDEV.S(10.1,9.8,9.7,9.1,10.2)"));
check("range COUNT skips blanks", evaluate("=COUNT(D5:D20)", ctx), 5);
check("blank is 0", evaluate("=B99+1", ctx), 1);
check("T-stat from cells", evaluate("=(AVERAGE(D5:D9)-10)/(STDEV.S(D5:D9)/SQRT(COUNT(D5:D9)))", ctx), (9.78 - 10) / (evaluate("=STDEV.S(10.1,9.8,9.7,9.1,10.2)") / Math.sqrt(5)));
for (const bad of ["=A1+1", "=D5:D9", "=B5"]) {
  let t = false; try { evaluate(bad, bad === "=B5" ? undefined : ctx); } catch { t = true; }
  if (!t) { fails++; console.log("FAIL should error:", bad); }
}
check("T.DIST still a function", evaluate("=T.DIST(-1,4,TRUE)", ctx), tCdf(-1, 4));
console.log(`${fails === 0 ? "PASS" : "FAILED"}: cell references, ${fails} failures`);
if (fails) process.exit(1);

// Chi-squared: exact closed forms (df = 1: 2Φ(√x) − 1; even df: Poisson sum), Lesson 18's own
// sheet, and the printed table.
{
  const even = (x: number, df: number) => { let term = 1, sum = 1; for (let k = 1; k < df / 2; k++) { term *= x / 2 / k; sum += term; } return 1 - Math.exp(-x / 2) * sum; };
  for (const x of [0.01, 0.3, 1, 2.7, 5, 9.4, 17, 33, 60]) {
    check(`chisq df1 ${x}`, chisqCdf(x, 1), 2 * normCdf(Math.sqrt(x)) - 1, 1e-10);
    for (const df of [2, 4, 10, 30, 80]) check(`chisq df${df} ${x}`, chisqCdf(x, df), even(x, df), 1e-10);
  }
  for (const p of [0.005, 0.025, 0.05, 0.2, 0.5, 0.8, 0.95, 0.975, 0.995]) for (const df of [1, 3, 4, 9, 14, 29, 99]) check(`chisqInv round trip ${p},${df}`, chisqCdf(chisqInv(p, df), df), p, 1e-10);
  check("CHISQ.INV(0.95,1)", chisqInv(0.95, 1), 3.841458820694124, 1e-9);
  check("CHISQ.INV(0.95,10)", chisqInv(0.95, 10), 18.307038053275146, 1e-9);
  check("CHISQ.INV(0.025,9)", chisqInv(0.025, 9), 2.7003894999803584, 1e-9);
  check("CHISQ.INV(0.975,9)", chisqInv(0.975, 9), 19.02276780221112, 1e-9);
  check("L18 CHISQ.INV(0.8,9)", evaluate("=_xlfn.CHISQ.INV(0.8,9)"), 12.24214546984707, 1e-9);
  check("L18 p-value", evaluate("=1-_xlfn.CHISQ.DIST(((10-1)/1)*0.7684551026184633,10-1,TRUE)"), 0.6458547441942721, 1e-9);
  console.log(`${fails === 0 ? "PASS" : "FAILED"}: chi-squared, ${fails} failures`);
  if (fails) process.exit(1);
}
