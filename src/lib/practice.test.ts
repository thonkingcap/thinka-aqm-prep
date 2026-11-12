// Proves every generated practice answer: the shown Excel formula evaluates to the shown answer,
// the formulas follow the professor's one-tail conventions, hypothesis-test decisions agree
// between the p-value and critical-value routes, and grading accepts right / rejects wrong-method answers.
// Run: node --experimental-strip-types src/lib/practice.test.ts
import { KINDS, generate, generateCase, parseAnswer, gradeNumber } from "./practice.ts";
import type { Question, Part, QuestionKind } from "./practice.ts";
import { evaluate } from "./excel.ts";
import { TWELVE, NULLS } from "./tests12.ts";
import { normCdf, normInv, tCdf, tInv } from "./stats.ts";

const SEEDS = 450;
let fails = 0, checks = 0;
const failMsgs: string[] = [];
function fail(msg: string) {
  fails++;
  if (failMsgs.length < 25) failMsgs.push(msg);
}
function check(cond: boolean, msg: () => string) {
  checks++;
  if (!cond) fail(msg());
}

const BANNED = /T\.DIST\.2T|T\.DIST\.RT|T\.INV\.2T|CHISQ\.DIST\.RT|CHISQ\.INV\.RT|\bABS\b|STANDARDIZE|CONFIDENCE\.NORM/i;
let wrongChecked = 0, wrongSkipped = 0;
let htTotal = 0, htReject = 0;

/** A plausible wrong-method formula for a part, or null when there is no single obvious slip. */
function wrongFormula(q: Question, p: Part): string | null {
  const f = p.excel;
  const L = p.label;
  const noSE = (s: string) => s.replace(/\/SQRT\((\d+)\)/g, "");
  switch (q.kind) {
    case "normal-less": return "=1-" + f.slice(1);
    case "normal-more": return "=" + f.slice(3);
    case "normal-inverse": return f.replace(/NORM\.INV\(([\d.]+),/, (_, x) => `NORM.INV(${Number((1 - Number(x)).toFixed(6))},`);
    case "zscore": return L.startsWith("z-score") ? `=-(${f.slice(1)})` : f.replace(/^=([\d.]+)([+-])/, (_, a, s) => `=${a}${s === "+" ? "-" : "+"}`);
    case "sample-mean": return noSE(f);
    case "xbar-range": case "ci-z":
      if (L.startsWith("Z_α/2")) return f.replace("/2)", ")");
      if (L.startsWith("Lower") || L.startsWith("Upper") || L.startsWith("Standard error")) return noSE(f);
      return null;
    case "ci-t":
      if (L.startsWith("Sample standard deviation")) return f.replace("STDEV.S", "STDEV.P");
      if (L.startsWith("T_α/2") || L.startsWith("Lower") || L.startsWith("Upper"))
        return f.replace(/T\.INV\(1-([\d.]+)\/2,\d+-1\)/, "NORM.S.INV(1-$1/2)");
      return null;
    case "ht": {
      const h0 = q.caseKey!.split("-")[0];
      if (L.startsWith("Sample standard deviation")) return f.replace("STDEV.S", "STDEV.P");
      if (L.startsWith("What is the test statistic")) return f.replace(/\/SQRT\(\d+\)\)$/, ")");
      if (L.startsWith("What is the p-value")) {
        if (h0 === "eq") return f.startsWith("=2*(1-") ? "=" + f.slice(4, -1) : "=" + f.slice(3);
        if (h0 === "le") return "=" + f.slice(3);
        return "=1-" + f.slice(1);
      }
      if (L.includes("critical value")) {
        if (h0 === "eq") return f.replace("/2,", ",").replace("/2)", ")");
        if (h0 === "le") return f.replace(/\(1-([\d.]+)/, "(1-$1/2");
        return f.replace(/INV\(([\d.]+)/, "INV(1-$1");
      }
      return null;
    }
    default: return null;
  }
}

function verifyQuestion(q: Question, expectKind: QuestionKind) {
  check(q.kind === expectKind, () => `${q.id}: kind ${q.kind} != ${expectKind}`);
  check(q.id === `${q.kind}-${q.seed}`, () => `${q.id}: bad id`);
  check(KINDS.some((k) => k.id === q.kind && k.topic === q.topic), () => `${q.id}: topic mismatch`);
  check(q.parts.length > 0 && q.parts.every((p, i) => p.id === "abcdefghijklmnop"[i]), () => `${q.id}: part ids`);
  check(!BANNED.test(q.prompt), () => `${q.id}: banned function in prompt`);
  for (const p of q.parts) {
    check(!BANNED.test(p.excel) && !BANNED.test(p.explain), () => `${q.id}/${p.id}: banned function in "${p.excel}"`);
    if (p.kind === "choice") {
      check(!!p.options && p.options.includes(p.answer as string), () => `${q.id}/${p.id}: answer not in options`);
      continue;
    }
    if (p.kind === "text") {
      check(typeof p.answer === "string" && p.answer.length > 20 && (p.keyPoints?.length ?? 0) >= 2, () => `${q.id}/${p.id}: written part needs a model answer and key points`);
      continue;
    }
    // Traps: every named slip that's really different from the answer must be graded wrong, and be finite.
    for (const t of p.traps ?? []) {
      if (!Number.isFinite(t.value)) continue;
      if (Math.abs(t.value - (p.answer as number)) > p.tol! * 1.5) { trapChecked++; check(!gradeNumber(String(t.value), p).ok, () => `${q.id}/${p.id}: trap ${t.value} ("${t.why}") graded right`); }
    }
    const ans = p.answer as number;
    check(typeof ans === "number" && Number.isFinite(ans), () => `${q.id}/${p.id}: non-finite answer`);
    check(p.excel.startsWith("="), () => `${q.id}/${p.id}: excel must start with =`);
    let v = NaN;
    try { v = evaluate(p.excel); } catch (e) { fail(`${q.id}/${p.id}: evaluate threw ${(e as Error).message} on ${p.excel}`); continue; }
    check(Math.abs(v - ans) <= 1e-9 * Math.max(1, Math.abs(ans)), () => `${q.id}/${p.id}: ${p.excel} = ${v}, answer ${ans}`);
    if (p.format === "prob") check(ans >= 0 && ans <= 1, () => `${q.id}/${p.id}: probability out of range ${ans}`);
    check(typeof p.tol === "number" && p.tol > 0, () => `${q.id}/${p.id}: missing tol`);
    // Grading: right answers pass.
    check(gradeNumber(ans.toFixed(4), p).ok, () => `${q.id}/${p.id}: rounded answer ${ans.toFixed(4)} rejected (tol ${p.tol})`);
    check(gradeNumber(p.excel, p).ok, () => `${q.id}/${p.id}: formula answer rejected`);
    // Grading: wrong-method answers fail (when the slip actually changes the number by more than tol).
    const wf = wrongFormula(q, p);
    if (wf !== null) {
      check(wf !== p.excel, () => `${q.id}/${p.id}: wrong-formula mutation did nothing on ${p.excel}`);
      let w = NaN;
      try { w = evaluate(wf); } catch (e) { fail(`${q.id}/${p.id}: wrong formula threw on ${wf}: ${(e as Error).message}`); continue; }
      if (Math.abs(w - ans) > p.tol!) {
        wrongChecked++;
        check(!gradeNumber(w.toFixed(4), p).ok && !gradeNumber(wf, p).ok, () => `${q.id}/${p.id}: wrong answer ${w} accepted (right ${ans})`);
      } else wrongSkipped++;
    }
  }
  if (q.kind === "ht") verifyHt(q);
  // Every test question: the decision follows p < α, and the critical-value route agrees.
  const dec = q.parts.find((p) => p.options?.includes("Reject H₀"));
  const pPart = q.parts.find((p) => /p-value/.test(p.label) && p.kind === "number");
  const aGiven = q.given?.find((g) => g.label === "α");
  if (dec && pPart && aGiven) {
    const rej = (pPart.answer as number) < Number(aGiven.value);
    check(dec.answer === (rej ? "Reject H₀" : "Do not reject H₀"), () => `${q.id}: decision ${dec.answer} but p = ${pPart.answer}`);
    const r = (rejByKind[q.kind] ??= [0, 0]); r[1]++; if (rej) r[0]++;
    const stat = q.parts.find((p) => /[Tt]est statistic/.test(p.label));
    const crits = q.parts.filter((p) => /critical value/i.test(p.label));
    if (stat && crits.length) {
      const st = stat.answer as number, h = q.parts[0].answer as string;
      const cs = crits.map((c) => c.answer as number);
      let cr: boolean;
      if (q.kind === "var-test") cr = cs.length === 2 ? st < cs[0] || st > cs[1] : h.includes("≤") ? st > cs[0] : st < cs[0];
      else if (h.includes("=") && !h.includes("≤") && !h.includes("≥")) cr = Math.abs(st) > cs[0];
      else cr = h.includes("≤") ? st > cs[0] : st < cs[0];
      if (q.kind !== "bernoulli") check(cr === rej, () => `${q.id}: p-value and critical-value routes disagree (stat ${st}, crit ${cs}, p ${pPart.answer})`);
    }
  }
}
const rejByKind: Record<string, [number, number]> = {};
let trapChecked = 0;

function verifyHt(q: Question) {
  htTotal++;
  const [h0, sigma, method] = q.caseKey!.split("-");
  check(TWELVE.some((c) => c.key === q.caseKey), () => `${q.id}: unknown caseKey`);
  const g = (l: string) => Number(q.given!.find((x) => x.label === l)!.value);
  const mu0 = g("μ₀"), n = g("n"), alpha = g("α");
  check([0.01, 0.05, 0.1].includes(alpha), () => `${q.id}: alpha ${alpha}`);
  const nullPart = q.parts[0];
  const idx = NULLS.findIndex((x) => x.id === h0);
  check(JSON.stringify(nullPart.options) === JSON.stringify(["≤", "=", "≥"].map((s) => `H₀: μ ${s} ${q.given![0].value}`)), () => `${q.id}: null options ${nullPart.options}`);
  check(nullPart.answer === nullPart.options![idx], () => `${q.id}: null answer ${nullPart.answer} for ${q.caseKey}`);
  const word = h0 === "le" ? "more than" : h0 === "ge" ? "less than" : "different from";
  check(q.prompt.includes(word), () => `${q.id}: prompt lacks "${word}"`);
  check((sigma === "unknown") === !!q.data || sigma === "known", () => `${q.id}: σ unknown needs data`);
  if (sigma === "unknown") check(q.data!.length === n && n >= 6 && n <= 14, () => `${q.id}: data length`);

  const statPart = q.parts.find((p) => p.label.startsWith("What is the test statistic"))!;
  const stat = statPart.answer as number;
  check(statPart.label.includes(sigma === "known" ? " Z?" : " T?"), () => `${q.id}: stat label`);
  const known = sigma === "known", df = n - 1;
  const cdf = (x: number) => (known ? normCdf(x) : tCdf(x, df));
  const inv = (p: number) => (known ? normInv(p) : tInv(p, df));
  const pVal = h0 === "le" ? 1 - cdf(stat) : h0 === "ge" ? cdf(stat) : stat < 0 ? 2 * cdf(stat) : 2 * (1 - cdf(stat));
  const critRej = h0 === "le" ? stat > inv(1 - alpha) : h0 === "ge" ? stat < inv(alpha) : Math.abs(stat) > inv(1 - alpha / 2);
  check(pVal >= 0 && pVal <= 1, () => `${q.id}: p out of range`);
  check((pVal < alpha) === critRej, () => `${q.id}: p-value (${pVal}) and critical-value decisions disagree`);
  const dec = q.parts[q.parts.length - 1];
  check(dec.answer === (critRej ? "Reject H₀" : "Do not reject H₀"), () => `${q.id}: decision ${dec.answer}`);
  check(JSON.stringify(dec.options) === JSON.stringify(["Reject H₀", "Do not reject H₀"]), () => `${q.id}: decision options`);
  if (critRej) htReject++;
  const four = q.parts[q.parts.length - 2];
  if (method === "p") {
    check(four.label === "What is the p-value?" && Math.abs((four.answer as number) - pVal) < 1e-12, () => `${q.id}: p-value part`);
  } else {
    const c = h0 === "le" ? inv(1 - alpha) : h0 === "ge" ? inv(alpha) : inv(1 - alpha / 2);
    check(four.label.includes("critical value") && Math.abs((four.answer as number) - c) < 1e-9, () => `${q.id}: crit part`);
    if (h0 === "eq") check((four.answer as number) > 0 && four.label.includes("positive"), () => `${q.id}: two-tailed crit should be positive`);
    if (h0 === "ge") check((four.answer as number) < 0, () => `${q.id}: left crit should be negative`);
  }
}

// 1–3: every kind, many seeds.
for (const k of KINDS) {
  for (let s = 1; s <= SEEDS; s++) {
    let q: Question;
    try { q = generate(k.id, s * 7919 + 13); } catch (e) { fail(`${k.id} seed ${s}: threw ${(e as Error).message}`); continue; }
    verifyQuestion(q, k.id);
  }
}
// 4: determinism, mixed, all 12 cases.
for (const k of KINDS) for (let s = 1; s <= 50; s++)
  check(JSON.stringify(generate(k.id, s)) === JSON.stringify(generate(k.id, s)), () => `${k.id}-${s} not deterministic`);
const seenKinds = new Set<string>();
for (let s = 1; s <= 300; s++) {
  const q = generate("mixed", s);
  seenKinds.add(q.kind);
  check(JSON.stringify(q) === JSON.stringify(generate(q.kind, s)), () => `mixed ${s} != generate(${q.kind}, ${s})`);
}
check(seenKinds.size === KINDS.length - 1 && !seenKinds.has("concept"), () => `mixed only produced ${[...seenKinds]}`);
check(typeof generate("mixed").id === "string" && typeof generate("ht").id === "string", () => "unseeded generate failed");
for (const c of TWELVE) for (let s = 1; s <= 120; s++) {
  const q = generateCase(c.key, s);
  check(q.caseKey === c.key && q.kind === "ht", () => `generateCase(${c.key}) gave ${q.caseKey}`);
  verifyQuestion(q, "ht");
  check(JSON.stringify(q) === JSON.stringify(generateCase(c.key, s)), () => `generateCase ${c.key} not deterministic`);
}
let threw = false;
try { generateCase("nope"); } catch { threw = true; }
check(threw, () => "generateCase should throw on an unknown key");

// 5: parseAnswer.
const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1e-12;
check(near(parseAnswer("3.12%").value, 0.0312), () => "3.12%");
check(Math.abs(parseAnswer("=NORM.S.INV(0.975)").value! - 1.959963984540054) < 1e-9, () => "=NORM.S.INV(0.975)");
check(near(parseAnswer("1,234.5").value, 1234.5), () => "1,234.5");
check(near(parseAnswer("-1.96").value, -1.96) && near(parseAnswer(" 0.0312 ").value, 0.0312) && near(parseAnswer(".5").value, 0.5), () => "plain numbers");
check(near(parseAnswer("−1.96").value, -1.96), () => "unicode minus");
const empty = parseAnswer("");
check(empty.value === null && empty.error === "Enter an answer", () => "empty");
check(parseAnswer("   ").error === "Enter an answer", () => "blank");
for (const g of ["abc", "1.2.3", "12,34", "=FOO(1)", "=1+", "%", "1e", "two"]) {
  const r = parseAnswer(g);
  check(r.value === null && typeof r.error === "string" && r.error.length > 0, () => `garbage "${g}" parsed as ${r.value}`);
}
check(!gradeNumber("", generate("normal-less", 1).parts[0]).ok, () => "empty graded ok");

const skipRate = wrongSkipped / Math.max(1, wrongChecked + wrongSkipped);
check(skipRate < 0.05, () => `too many wrong-method checks skipped: ${(skipRate * 100).toFixed(1)}%`);
const rejRate = htReject / htTotal;
for (const [k, [r, t]] of Object.entries(rejByKind)) check(r / t > 0.25 && r / t < 0.8, () => `${k} reject rate ${(r / t * 100).toFixed(0)}%`);
check(rejRate > 0.3 && rejRate < 0.7, () => `ht reject rate ${rejRate}`);

for (const m of failMsgs) console.log("FAIL", m);
console.log(`${fails === 0 ? "PASS" : "FAILED"}: ${checks} checks, ${fails} failures; ${KINDS.length} kinds × ${SEEDS} seeds + 12 cases × 120; ` +
  `${trapChecked} named slips graded wrong; wrong-method answers rejected in ${wrongChecked} cases (${wrongSkipped} too close to judge); ht reject rate ${(rejRate * 100).toFixed(1)}%`);
if (fails) process.exit(1);
