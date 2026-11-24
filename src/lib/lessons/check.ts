// Proves a block's answer key: every answer cell's formula, evaluated on the tab's own cells, gives the
// stated answer. Used by lessons.test.ts (and by the kit's authors while writing a lesson).
import { evaluateAny } from "../excel.ts";
import { matchChoice } from "../workbook.ts";
import { blockSheet, tabName, tolFor, TOP, type Block, type BlockMaker } from "./kit.ts";
import type { Lesson } from "./types.ts";

export function checkBlock(b: Block, where: string): string[] {
  const errs: string[] = [];
  const e = (m: string) => errs.push(`${where}: ${m}`);
  if (!b.tab || b.tab.length > 26) e(`tab "${b.tab}" must be 1–26 characters`);
  if (/[[\]:*?/\\]/.test(b.tab)) e(`tab "${b.tab}" has a character Excel forbids`);
  if (!b.text.length || b.text.length > 5) e(`text must be 1–5 paragraphs (has ${b.text.length})`);
  const parts = new Set(b.parts.map((p) => p.cell));
  if (parts.size !== b.parts.length) e("two parts share an answer cell");
  for (const [a, c] of Object.entries(b.cells)) {
    const m = /^([A-Z]+)(\d+)$/.exec(a);
    if (!m) { e(`bad address ${a}`); continue; }
    if (Number(m[2]) < TOP) e(`${a} is above row ${TOP} (rows 1–7 are the title and question text)`);
    if (m[1] === "A") e(`${a}: column A is kept empty as a margin`);
    if (parts.has(a)) e(`${a} is an answer cell but also has content`);
    if (typeof c.v === "number" && !Number.isFinite(c.v)) e(`${a} holds a non-finite number`);
    if (c.f) e(`${a}: question cells hold values, not formulas`);
  }
  if (!b.parts.length) e("no answer cells");
  // Evaluate with the key: answer cells refer to one another, so resolve them on demand.
  const sheet = blockSheet(b, 0, true);
  const byCell = new Map(b.parts.map((p) => [p.cell, p]));
  const memo = new Map<string, number | string | null>();
  const busy = new Set<string>();
  const get = (addr: string): number | string | null => {
    if (memo.has(addr)) return memo.get(addr)!;
    const p = byCell.get(addr);
    if (!p) {
      const v = sheet.cells[addr]?.v;
      return v === undefined ? null : (v as number | string);
    }
    if (busy.has(addr)) throw new Error(`circular reference through ${addr}`);
    busy.add(addr);
    try {
      const lit = /^"(.*)"$/.exec(p.formula.trim());
      const v = lit ? lit[1] : evaluateAny(p.formula, { get });
      const out = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : v;
      memo.set(addr, out);
      return out;
    } finally { busy.delete(addr); }
  };
  for (const p of b.parts) {
    if (!p.formula.trim().startsWith("=") && !/^".*"$/.test(p.formula.trim())) { e(`${p.cell} ${p.label}: formula must start with = (or be a quoted literal)`); continue; }
    if (/\bRAND(BETWEEN)?\s*\(/i.test(p.formula)) { e(`${p.cell}: RAND in a marked cell can't be marked`); continue; }
    if (!p.explain?.trim()) e(`${p.cell}: no explanation`);
    let got: number | string | null;
    try { got = get(p.cell); } catch (x) { e(`${p.cell} ${p.label}: ${p.formula} → ${(x as Error).message}`); continue; }
    if (p.options) {
      if (!p.options.includes(String(p.answer))) e(`${p.cell}: answer "${p.answer}" is not one of the options`);
      const picked = matchChoice(String(got), p.options);
      if (picked !== p.answer) e(`${p.cell} ${p.label}: key gives "${got}" but the answer is "${p.answer}"`);
    } else {
      if (typeof p.answer !== "number" || !Number.isFinite(p.answer)) { e(`${p.cell}: numeric answer expected`); continue; }
      if (typeof got !== "number") { e(`${p.cell} ${p.label}: key gives "${got}", not a number`); continue; }
      const tol = tolFor(p);
      if (Math.abs(got - p.answer) > Math.max(tol, 1e-9 * Math.abs(p.answer)) + 1e-12) e(`${p.cell} ${p.label}: key gives ${got} but answer is ${p.answer} (tol ${tol})`);
      for (const t of p.traps ?? []) if (Math.abs(t.value - p.answer) <= tol * 1.5) e(`${p.cell}: trap "${t.why}" (${t.value}) is too close to the right answer`);
      for (const a of p.alts ?? []) {
        if (!Number.isFinite(a)) e(`${p.cell}: alternative answer must be a finite number`);
        for (const t of p.traps ?? []) if (Math.abs(t.value - a) <= tol * 1.5) e(`${p.cell}: trap "${t.why}" equals an accepted alternative`);
      }
    }
  }
  return errs;
}

export function checkMaker(m: BlockMaker, seeds: number, rngFor: (k: string) => () => number): string[] {
  const errs: string[] = [];
  if (!/^l\d+\.[a-z0-9-]+$/.test(m.key)) errs.push(`maker key "${m.key}" should look like "l8.breakeven"`);
  for (let s = 1; s <= seeds; s++) {
    const key = `check|${s}|${m.key}`;
    let b: Block;
    try { b = m.make(rngFor(key)); } catch (x) { errs.push(`${m.key} seed ${s}: make() threw ${(x as Error).message}`); continue; }
    errs.push(...checkBlock(b, `${m.key} seed ${s}`));
    // Same seed, same numbers.
    const again = m.make(rngFor(key));
    if (JSON.stringify(again) !== JSON.stringify(b)) errs.push(`${m.key} seed ${s}: not deterministic`);
    if (s === 1) tabName(0, b);
  }
  return errs;
}

export function checkLesson(L: Lesson): string[] {
  const errs: string[] = [];
  const e = (m: string) => errs.push(`Lesson ${L.n}: ${m}`);
  if (!L.title || !L.summary) e("title and summary are required");
  if (L.defs.length < 3) e("needs at least 3 definitions");
  if (!L.examples.length) e("needs a worked example");
  if (L.quiz.length < 5) e("needs at least 5 quiz questions");
  L.quiz.forEach((q, i) => {
    if (q.options.length < 2 || q.options.length > 5) e(`quiz ${i + 1}: 2–5 options`);
    if (!(q.answer >= 0 && q.answer < q.options.length)) e(`quiz ${i + 1}: answer index out of range`);
    if (new Set(q.options).size !== q.options.length) e(`quiz ${i + 1}: duplicate options`);
    if (!q.why) e(`quiz ${i + 1}: needs a why`);
  });
  if (!L.makers.length) e("needs at least one practice block");
  const keys = new Set<string>();
  for (const m of L.makers) {
    if (keys.has(m.key)) e(`duplicate maker key ${m.key}`);
    keys.add(m.key);
    if (!m.key.startsWith(`l${L.n}.`)) e(`maker key ${m.key} should start with l${L.n}.`);
  }
  return errs;
}
