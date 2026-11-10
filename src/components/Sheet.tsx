// A small Excel: the question's numbers already in their cells, formulas with references and ranges,
// a formula bar, keyboard navigation, and click-to-insert references while typing a formula.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ChangeEvent, type SyntheticEvent } from "react";
import { RotateCcw } from "lucide-react";
import { evaluate, colName, colIndex } from "../lib/excel.ts";
import { SHEET_COLS, type SheetModel } from "../lib/workbook.ts";
import { formulaHelp, type FnDoc } from "../lib/fnDocs.ts";
import "./sheet.css";

export type SheetValue = number | string | null;
type Raw = Record<string, string>; // what's typed in each cell (the formula or the constant)

const COL_PX = [230, 112, 44, 92, 44, 104, 104, 104];
const KEY = (id: string) => `aqm.sheet.${id}`;

function initialRaw(model: SheetModel): Raw {
  const raw: Raw = {};
  for (const [addr, c] of Object.entries(model.cells)) {
    if (c.v === undefined) continue;
    if (addr === "A2") continue; // the question text is shown above the sheet
    raw[addr] = typeof c.v === "number" ? String(c.v) : c.v;
  }
  raw.A2 = "Question text is above the sheet.";
  return raw;
}

function errCode(msg: string): string {
  const m = /^#[A-Z/0!?]+/.exec(msg);
  return m ? m[0] : "#ERROR";
}

export function fmtCell(v: SheetValue, pct?: boolean): string {
  if (v === null) return "";
  if (typeof v === "string") return v;
  if (pct) return `${Number((v * 100).toFixed(4))}%`;
  if (Number.isInteger(v) && Math.abs(v) < 1e12) return String(v);
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-4 || a >= 1e9)) return v.toExponential(4);
  return String(Number(v.toPrecision(8)));
}

/** Computes every cell's value from the raw entries, with cycle detection. */
export function computeSheet(raw: Raw): { values: Record<string, SheetValue>; errors: Record<string, string> } {
  const values: Record<string, SheetValue> = {};
  const errors: Record<string, string> = {};
  const visiting = new Set<string>();
  const get = (addr: string): number | string | null => {
    if (addr in values) return values[addr];
    if (errors[addr]) throw new Error(errors[addr]);
    const r = raw[addr];
    if (r === undefined || r.trim() === "") return null;
    const t = r.trim();
    if (!t.startsWith("=")) {
      const pct = /^-?\d*\.?\d+%$/.test(t);
      const n = Number(pct ? t.slice(0, -1) : t.replace(/,/g, ""));
      values[addr] = t !== "" && Number.isFinite(n) ? (pct ? n / 100 : n) : r;
      return values[addr];
    }
    if (visiting.has(addr)) throw new Error(`#CIRC! ${addr} refers to itself`);
    visiting.add(addr);
    try {
      const v = evaluate(t, { get });
      values[addr] = v;
      return v;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors[addr] = msg;
      throw e;
    } finally {
      visiting.delete(addr);
    }
  };
  for (const addr of Object.keys(raw)) {
    try { get(addr); } catch { /* recorded in errors */ }
  }
  return { values, errors };
}

export default function Sheet({ model, storageId, onValues }: {
  model: SheetModel;
  storageId: string;
  onValues?: (get: (addr: string) => SheetValue) => void;
}) {
  const [raw, setRaw] = useState<Raw>(() => {
    try { const s = localStorage.getItem(KEY(storageId)); if (s) return JSON.parse(s) as Raw; } catch { /* ignore */ }
    return initialRaw(model);
  });
  const [sel, setSel] = useState({ c: 5, r: 5 }); // the active cell (F5: the working area)
  const [ext, setExt] = useState({ c: 5, r: 5 }); // the other corner of a selected range
  const dragRef = useRef<null | { mode: "select" } | { mode: "point"; base: string; at: number; start: { c: number; r: number } }>(null);
  const [editing, setEditing] = useState<string | null>(null); // draft text while editing
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // A hidden text box holds focus while a cell is selected, so every kind of keyboard (phones, IMEs,
  // pasted text) can start typing into the cell, the way Google Sheets does it.
  const catcherRef = useRef<HTMLInputElement>(null);
  const focusCatcher = () => catcherRef.current?.focus({ preventScroll: true });
  // Formula AutoComplete and the argument ScreenTip, as in Excel.
  const [caret, setCaret] = useState(0);
  const [activeEd, setActiveEd] = useState<"cell" | "bar">("cell");
  const [pick, setPick] = useState(0);
  const [helpClosed, setHelpClosed] = useState(false);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  const rows = Math.max(model.rows, 20);
  const addr = `${colName(sel.c)}${sel.r}`;

  useEffect(() => { setRaw(() => { try { const s = localStorage.getItem(KEY(storageId)); if (s) return JSON.parse(s) as Raw; } catch { /* ignore */ } return initialRaw(model); }); }, [storageId, model]);
  useEffect(() => { try { localStorage.setItem(KEY(storageId), JSON.stringify(raw)); } catch { /* ignore */ } }, [raw, storageId]);

  const { values, errors } = useMemo(() => computeSheet(raw), [raw]);
  const getValue = useCallback((a: string): SheetValue => (errors[a] ? null : values[a] ?? null), [values, errors]);
  useEffect(() => { onValues?.(getValue); }, [getValue, onValues]);

  const answerSet = useMemo(() => new Set(Object.values(model.answerCells)), [model]);

  function commit(text: string | null, move: { dc: number; dr: number } = { dc: 0, dr: 1 }) {
    if (text !== null) setRaw((r) => ({ ...r, [addr]: text }));
    setEditing(null);
    moveSel(move.dc, move.dr);
    requestAnimationFrame(focusCatcher);
  }
  const clampCell = (p: { c: number; r: number }) => ({ c: Math.min(SHEET_COLS.length - 1, Math.max(0, p.c)), r: Math.min(rows, Math.max(1, p.r)) });
  function moveSel(dc: number, dr: number) {
    setSel((s) => { const n = clampCell({ c: s.c + dc, r: s.r + dr }); setExt(n); return n; });
  }
  function extendSel(dc: number, dr: number) {
    setExt((x) => clampCell({ c: x.c + dc, r: x.r + dr }));
  }
  // The selected range: top-left to bottom-right of the active cell and the extent.
  const r0 = Math.min(sel.r, ext.r), r1 = Math.max(sel.r, ext.r), c0 = Math.min(sel.c, ext.c), c1 = Math.max(sel.c, ext.c);
  const isRange = r0 !== r1 || c0 !== c1;
  const rangeText = (a: { c: number; r: number }, b: { c: number; r: number }) => {
    const tl = `${colName(Math.min(a.c, b.c))}${Math.min(a.r, b.r)}`, br = `${colName(Math.max(a.c, b.c))}${Math.max(a.r, b.r)}`;
    return tl === br ? tl : `${tl}:${br}`;
  };
  // Release a drag wherever the mouse button comes up.
  useEffect(() => {
    const up = () => { dragRef.current = null; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);
  const help = editing !== null && !helpClosed ? formulaHelp(editing, Math.min(caret, editing.length)) : null;
  const activeInput = () => (activeEd === "bar" ? barRef.current : inputRef.current) ?? inputRef.current ?? barRef.current;

  useLayoutEffect(() => {
    const el = activeInput();
    const root = rootRef.current;
    if (!help || !el || !root) { setTipPos(null); return; }
    const a = el.getBoundingClientRect(), b = root.getBoundingClientRect();
    setTipPos({ top: a.bottom - b.top + 4, left: Math.max(0, Math.min(a.left - b.left, b.width - 340)) });
  }, [help?.kind, editing, activeEd, sel.c, sel.r]); // eslint-disable-line react-hooks/exhaustive-deps

  function onDraft(e: ChangeEvent<HTMLInputElement>) {
    setEditing(e.target.value);
    setCaret(e.target.selectionStart ?? e.target.value.length);
    setPick(0);
    setHelpClosed(false);
  }
  function onCaret(e: SyntheticEvent<HTMLInputElement>) {
    setCaret((e.target as HTMLInputElement).selectionStart ?? 0);
  }
  /** Replace the word being typed with the chosen function and its opening parenthesis. */
  function insertFn(doc: FnDoc) {
    if (editing === null || help?.kind !== "suggest") return;
    const end = Math.min(caret, editing.length);
    const ins = doc.args.length ? `${doc.name}(` : doc.name;
    const next = editing.slice(0, help.start) + ins + editing.slice(end);
    const pos = help.start + ins.length;
    setEditing(next);
    setCaret(pos);
    setPick(0);
    requestAnimationFrame(() => { const el = activeInput(); if (el) { el.focus(); el.setSelectionRange(pos, pos); } });
  }

  function startEdit(initial?: string) {
    setActiveEd("cell");
    setHelpClosed(false);
    setCaret((initial ?? raw[addr] ?? "").length);
    setEditing(initial ?? raw[addr] ?? "");
    requestAnimationFrame(() => { const el = inputRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  }

  function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
    if (editing !== null) {
      // Keys typed before the edit box took focus: keep them instead of dropping them.
      if (e.target === gridRef.current || e.target === catcherRef.current) {
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setEditing((d) => (d ?? "") + e.key); setCaret((c) => c + 1); }
        else if (e.key === "Backspace") { e.preventDefault(); setEditing((d) => (d ?? "").slice(0, -1)); }
        else if (e.key === "Enter") { e.preventDefault(); commit(editing, { dc: 0, dr: 1 }); }
        else if (e.key === "Escape") { e.preventDefault(); setEditing(null); }
      }
      return;
    }
    const k = e.key;
    const arrows: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (arrows[k]) { e.preventDefault(); const [dc, dr] = arrows[k]; if (e.shiftKey) extendSel(dc, dr); else moveSel(dc, dr); }
    else if (k === "Tab") { e.preventDefault(); moveSel(e.shiftKey ? -1 : 1, 0); }
    else if (k === "Enter" || k === "F2") { e.preventDefault(); startEdit(); }
    else if (k === "Backspace" || k === "Delete") {
      e.preventDefault();
      setRaw((r) => {
        const n = { ...r };
        for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) delete n[`${colName(cc)}${rr}`];
        return n;
      });
    }
    else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); startEdit(k); }
  }

  function onEditKey(e: KeyboardEvent<HTMLInputElement>) {
    if (help?.kind === "suggest") {
      const n = help.items.length;
      if (e.key === "ArrowDown") { e.preventDefault(); setPick((p) => (p + 1) % n); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setPick((p) => (p - 1 + n) % n); return; }
      if (e.key === "Tab") { e.preventDefault(); insertFn(help.items[Math.min(pick, n - 1)]); return; }
      if (e.key === "Escape") { e.preventDefault(); setHelpClosed(true); return; }
    }
    if (e.key === "Enter") { e.preventDefault(); commit(editing, { dc: 0, dr: e.shiftKey ? -1 : 1 }); }
    else if (e.key === "Tab") { e.preventDefault(); commit(editing, { dc: e.shiftKey ? -1 : 1, dr: 0 }); }
    else if (e.key === "Escape") { e.preventDefault(); setEditing(null); requestAnimationFrame(focusCatcher); }
  }

  function onCatcherInput(e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    e.target.value = "";
    if (!v) return;
    if (editing === null) startEdit(v);
    else { setEditing((d) => (d ?? "") + v); setCaret((c) => c + v.length); }
  }
  function onCatcherKey(e: KeyboardEvent<HTMLInputElement>) {
    // Printable keys arrive through onCatcherInput; navigation keys behave as on the grid.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) return;
    onGridKey(e as unknown as KeyboardEvent<HTMLDivElement>);
  }

  /** While typing a formula, clicking a cell inserts its address (Excel's "point" mode). */
  function onCellMouseDown(c: number, r: number, e: React.MouseEvent) {
    const a = `${colName(c)}${r}`;
    if (editing !== null && editing.trim().startsWith("=") && a !== addr && /[=(,+\-*/^:]\s*$/.test(editing.slice(0, Math.min(caret, editing.length)))) {
      e.preventDefault();
      const at = Math.min(caret, editing.length);
      dragRef.current = { mode: "point", base: editing, at, start: { c, r } };
      setEditing(editing.slice(0, at) + a + editing.slice(at));
      setCaret(at + a.length);
      requestAnimationFrame(() => { const el = activeInput(); if (el) { el.focus(); el.setSelectionRange(at + a.length, at + a.length); } });
      return;
    }
    if (editing !== null) commit(editing, { dc: 0, dr: 0 });
    e.preventDefault();
    if (e.shiftKey) { setExt({ c, r }); }
    else { setSel({ c, r }); setExt({ c, r }); dragRef.current = { mode: "select" }; }
    focusCatcher();
  }

  /** Dragging: extend the selection, or (while typing a formula) turn the inserted cell into a range like D5:D14. */
  function onCellEnter(c: number, r: number, e: React.MouseEvent) {
    const d = dragRef.current;
    if (!d || e.buttons !== 1) return;
    if (d.mode === "select") { setExt({ c, r }); return; }
    const ref = rangeText(d.start, { c, r });
    const next = d.base.slice(0, d.at) + ref + d.base.slice(d.at);
    setEditing(next);
    setCaret(d.at + ref.length);
    requestAnimationFrame(() => { const el = activeInput(); if (el) { el.focus(); el.setSelectionRange(d.at + ref.length, d.at + ref.length); } });
  }

  function reset() {
    if (!confirm("Clear your work and put the original numbers back?")) return;
    setRaw(initialRaw(model));
    setEditing(null);
  }

  const shownRaw = editing ?? raw[addr] ?? "";
  const selErr = errors[addr];
  // Excel's status bar for a multi-cell selection: average, count and sum of what's selected.
  const status = useMemo(() => {
    if (!isRange) return null;
    let count = 0, n = 0, sum = 0;
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      const a = `${colName(cc)}${rr}`;
      const v = errors[a] ? null : values[a] ?? null;
      if (v === null || v === "") continue;
      count++;
      if (typeof v === "number") { n++; sum += v; }
    }
    return { count, n, sum, avg: n ? sum / n : null };
  }, [isRange, r0, r1, c0, c1, values, errors]);

  return (
    <div className="sheet" data-ui ref={rootRef}>
      <div className="sheet-bar">
        <span className="sheet-addr num" aria-label="Selected cell">{isRange && editing === null ? `${r1 - r0 + 1}R × ${c1 - c0 + 1}C` : addr}</span>
        <span className="sheet-fx" aria-hidden="true">fx</span>
        <input
          ref={barRef}
          className="sheet-formula"
          aria-label={`Contents of ${addr}`}
          value={shownRaw}
          onFocus={(e) => { setActiveEd("bar"); if (editing === null) { setEditing(raw[addr] ?? ""); setHelpClosed(false); } setCaret(e.target.selectionStart ?? 0); }}
          onChange={onDraft}
          onSelect={onCaret}
          onKeyDown={onEditKey}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="button" className="sheet-reset" onClick={reset} title="Reset the sheet" aria-label="Reset the sheet"><RotateCcw size={14} aria-hidden="true" /></button>
      </div>
      <input
        ref={catcherRef}
        className="sh-catcher"
        aria-label={`Cell ${addr}. Type to enter a value or formula`}
        onChange={onCatcherInput}
        onKeyDown={onCatcherKey}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        tabIndex={-1}
      />
      <div className="sheet-scroll">
        <div
          className="sheet-grid"
          ref={gridRef}
          tabIndex={0}
          role="grid"
          aria-label="Practice spreadsheet"
          onKeyDown={onGridKey}
          style={{ gridTemplateColumns: `36px ${COL_PX.map((w) => `${w}px`).join(" ")}` }}
        >
          <div className="sh-corner" />
          {SHEET_COLS.map((c, ci) => <div key={c} className={`sh-col${ci >= c0 && ci <= c1 ? " on" : ""}`} role="columnheader">{c}</div>)}
          {Array.from({ length: rows }, (_, ri) => {
            const r = ri + 1;
            return [
              <div key={`h${r}`} className={`sh-row${r >= r0 && r <= r1 ? " on" : ""}`} role="rowheader">{r}</div>,
              ...SHEET_COLS.map((cl, c) => {
                const a = `${cl}${r}`;
                const meta = model.cells[a];
                const isSel = c === sel.c && r === sel.r;
                const inRange = isRange && r >= r0 && r <= r1 && c >= c0 && c <= c1;
                const err = errors[a];
                const v = values[a] ?? null;
                const text = err ? errCode(err) : fmtCell(v, meta?.pct || (/%$/.test(raw[a] ?? "") && !String(raw[a]).startsWith("=")));
                const isNum = typeof v === "number" && !err;
                const overflow = (a === "A1" || a === "A2" || meta?.role === "hint") && !raw[`${colName(c + 1)}${r}`];
                return (
                  <div
                    key={a}
                    role="gridcell"
                    aria-selected={isSel || inRange}
                    className={[
                      "sh-cell",
                      meta?.role ? `r-${meta.role}` : "",
                      answerSet.has(a) ? "r-answer" : "",
                      isNum ? "is-num" : "",
                      err ? "is-err" : "",
                      overflow ? "is-overflow" : "",
                      isSel ? "is-sel" : "",
                      inRange ? "in-range" : "",
                      inRange && r === r0 ? "rt" : "", inRange && r === r1 ? "rb" : "", inRange && c === c0 ? "rl" : "", inRange && c === c1 ? "rr" : "",
                    ].join(" ")}
                    title={err ?? undefined}
                    onMouseDown={(e) => onCellMouseDown(c, r, e)}
                    onMouseEnter={(e) => onCellEnter(c, r, e)}
                    onDoubleClick={() => { setSel({ c, r }); startEdit(); }}
                  >
                    {isSel && editing !== null ? (
                      <input
                        ref={inputRef}
                        autoFocus
                        className="sh-edit"
                        value={editing}
                        onChange={onDraft}
                        onSelect={onCaret}
                        onFocus={() => setActiveEd("cell")}
                        onKeyDown={onEditKey}
                        onBlur={(e) => { if (e.relatedTarget !== barRef.current) { /* keep draft until Enter/Esc */ } }}
                        spellCheck={false}
                        autoComplete="off"
                        aria-label={`Editing ${a}`}
                      />
                    ) : (
                      <span>{text}</span>
                    )}
                  </div>
                );
              }),
            ];
          })}
        </div>
      </div>
      {help && tipPos && (
        <div className="fx-pop" style={{ top: tipPos.top, left: tipPos.left }}>
          {help.kind === "suggest" ? (
            <>
              <ul className="fx-list" role="listbox" aria-label="Matching functions">
                {help.items.map((d, k) => (
                  <li
                    key={d.name}
                    role="option"
                    aria-selected={k === pick}
                    className={k === pick ? "on" : ""}
                    onMouseDown={(e) => { e.preventDefault(); insertFn(d); }}
                    onMouseEnter={() => setPick(k)}
                  >
                    <code className="fx-name"><b>{d.name.slice(0, help.prefix.length)}</b>{d.name.slice(help.prefix.length)}</code>
                    <span className="fx-sum">{d.summary}</span>
                    {!d.inClass && <span className="fx-tag">not used in class</span>}
                  </li>
                ))}
              </ul>
              <p className="fx-foot">Tab to insert · ↑ ↓ to choose · Esc to close</p>
            </>
          ) : (
            <ArgTip doc={help.doc} argIndex={help.argIndex} />
          )}
        </div>
      )}
      <p className="sheet-help hint">
        {status && editing === null ? (
          <span className="sheet-status num">
            {status.avg !== null && <>Average: <b>{fmtCell(status.avg)}</b></>}
            <>Count: <b>{status.count}</b></>
            {status.n > 0 && <>Sum: <b>{fmtCell(status.sum)}</b></>}
          </span>
        ) : selErr ? <span className="error-text">{addr}: {selErr}</span> : <>Click a cell and type. Start with = for a formula; while typing one, click a cell to insert it, like Excel. Yellow cells are for your answers.</>}
      </p>
    </div>
  );
}

/** Excel's ScreenTip: the function's arguments with the current one in bold, and what goes there. */
function ArgTip({ doc, argIndex }: { doc: FnDoc; argIndex: number }) {
  const idx = doc.variadic ? Math.min(argIndex, doc.args.length - 1) : argIndex;
  const cur = doc.args[idx];
  return (
    <div className="fx-tip" role="tooltip">
      <code className="fx-sig">
        {doc.name}(
        {doc.args.map((a, k) => (
          <span key={a.name}>
            {k > 0 && ", "}
            {k === idx ? <b>{a.optional ? `[${a.name}]` : a.name}</b> : a.optional ? `[${a.name}]` : a.name}
          </span>
        ))}
        {doc.variadic && ", …"})
      </code>
      {cur ? <p className="fx-arg"><b>{cur.name}</b>: {cur.help}</p> : <p className="fx-arg">Too many arguments: {doc.name} takes {doc.args.length}.</p>}
      <p className="fx-sum">{doc.summary}</p>
    </div>
  );
}

export { colIndex };
