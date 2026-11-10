// Minimal .xlsx reader for uploaded practice workbooks (Excel, Google Sheets, Numbers export,
// LibreOffice, openpyxl). Reads cell values only — cached results for formulas, no styles.
// Hand-rolled tag scanner so it runs both in the browser and in Node tests (no DOMParser).
import { unzipSync, strFromU8 } from "fflate";

export type CellVal = number | string | boolean | null; // errors come back as "#N/A", "#DIV/0!", …
export type ReadWorkbook = {
  sheets: Record<string, Record<string, CellVal>>;
  sheetOrder: string[];
  thinkaId: string | null;
};

const NOT_XLSX = "That file isn't an Excel workbook (.xlsx). In Excel use File → Save As → Excel Workbook (.xlsx).";
const OLD_XLS = "That looks like an old-style Excel file (.xls). Please open it in Excel and use File → Save As → Excel Workbook (.xlsx), then upload that.";
const NUMBERS = "That looks like a Numbers file (.numbers). In Numbers use File → Export To → Excel… (.xlsx), then upload that.";
const CSV = "That looks like a CSV/text file, which can't hold the workbook's sheets. Please upload the .xlsx workbook (File → Save As → Excel Workbook (.xlsx)).";
const DAMAGED = "We couldn't read that workbook — it may be damaged. Try saving it again as an Excel Workbook (.xlsx) and re-uploading.";
const ID_PREFIX = "thinka-id:";

// ---------- tiny XML scanner ----------
type Tag = { name: string; attrs: Record<string, string>; selfClosing: boolean; start: number; end: number };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decode(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(cp); } catch { return m; }
    }
    return ENTITIES[e] ?? m;
  });
}
// Excel escapes control chars as _xHHHH_ inside strings.
function decodeOoxml(s: string): string {
  return s.includes("_x") ? s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))) : s;
}

const localName = (n: string) => { const i = n.indexOf(":"); return i < 0 ? n : n.slice(i + 1); };

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out[m[1]] = decode(m[3] ?? m[4] ?? "");
  return out;
}

/** Yields every element start tag (and self-closing tag) in order; names are prefix-stripped. */
function* tags(xml: string, from = 0, to = xml.length): Generator<Tag> {
  const re = /<([A-Za-z_][\w:.-]*)((?:\s+[^>]*?)?)(\/?)>/g;
  re.lastIndex = from;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && m.index < to) {
    yield { name: localName(m[1]), attrs: parseAttrs(m[2]), selfClosing: m[3] === "/", start: m.index, end: re.lastIndex };
  }
}

/** Index of the matching close tag for a local name (prefix-agnostic), from position `from`. */
function closeIndex(xml: string, local: string, from: number): number {
  const re = new RegExp(`</(?:[\\w.-]+:)?${local}\\s*>`, "g");
  re.lastIndex = from;
  const m = re.exec(xml);
  return m ? m.index : -1;
}

/** Concatenated text of all <t> elements in a range (handles rich-text runs; skips phonetic <rPh>). */
function textOfT(xml: string, from: number, to: number): string {
  let out = "";
  const re = /<(\/?)((?:[\w.-]+:)?(t|rPh))(\s[^>]*)?(\/?)>/g;
  re.lastIndex = from;
  let inPh = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && m.index < to) {
    const [, close, , local, , self] = m;
    if (local === "rPh") { if (!self) inPh += close ? -1 : 1; continue; }
    if (close || self) continue;
    const end = closeIndex(xml, "t", re.lastIndex);
    if (end < 0 || end > to) break;
    if (!inPh) out += decode(xml.slice(re.lastIndex, end));
    re.lastIndex = end;
  }
  return decodeOoxml(out);
}

function innerText(xml: string, local: string, from: number, to: number): string | null {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}(\\s[^>]*)?(/?)>`, "g");
  re.lastIndex = from;
  const m = re.exec(xml);
  if (!m || m.index >= to) return null;
  if (m[2] === "/") return "";
  const end = closeIndex(xml, local, re.lastIndex);
  if (end < 0 || end > to) return null;
  return decode(xml.slice(re.lastIndex, end));
}

// ---------- package helpers ----------
function normPath(p: string): string {
  const parts: string[] = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop(); else parts.push(seg);
  }
  return parts.join("/");
}

function resolveTarget(baseDir: string, target: string): string {
  if (/^[a-z]+:/i.test(target)) return target; // external
  return target.startsWith("/") ? normPath(target) : normPath(`${baseDir}/${target}`);
}

function sniff(bytes: Uint8Array): void {
  const b = bytes;
  if (b.length >= 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) throw new Error(OLD_XLS);
  if (b.length < 4 || b[0] !== 0x50 || b[1] !== 0x4b) {
    // Not a zip. Looks like text? (CSV / TSV / HTML-saved-as-xls)
    const head = strFromU8(b.subarray(0, 512), true);
    if (b.length && /^[\x09\x0a\x0d\x20-\x7e -￿]*$/.test(head) && /[,;\t\n]/.test(head) && !/<html|<\?xml/i.test(head)) throw new Error(CSV);
    throw new Error(NOT_XLSX);
  }
}

function getText(files: Record<string, Uint8Array>, path: string): string | null {
  const f = files[path] ?? files[Object.keys(files).find((k) => k.toLowerCase() === path.toLowerCase()) ?? ""];
  return f ? strFromU8(f) : null;
}

// ---------- parts ----------
function readSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const out: string[] = [];
  const re = /<(?:[\w.-]+:)?si(\s[^>]*)?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[2] === "/") { out.push(""); continue; }
    const end = closeIndex(xml, "si", re.lastIndex);
    if (end < 0) break;
    out.push(textOfT(xml, re.lastIndex, end));
    re.lastIndex = end;
  }
  return out;
}

function numOrStr(raw: string): CellVal {
  const n = Number(raw.trim());
  return raw.trim() !== "" && Number.isFinite(n) ? n : raw;
}

function readSheet(xml: string, shared: string[]): Record<string, CellVal> {
  const out: Record<string, CellVal> = {};
  const sdStart = xml.search(/<(?:[\w.-]+:)?sheetData[\s>/]/);
  if (sdStart < 0) return out;
  const sdEnd = closeIndex(xml, "sheetData", sdStart);
  const stop = sdEnd < 0 ? xml.length : sdEnd;
  let row = 0, col = 0;
  for (const t of tags(xml, sdStart, stop)) {
    if (t.name === "row") { row = Number(t.attrs.r) || row + 1; col = 0; continue; }
    if (t.name !== "c") continue;
    let addr = (t.attrs.r ?? "").toUpperCase();
    const pm = /^([A-Z]{1,3})(\d+)$/.exec(addr);
    if (pm) { col = colNum(pm[1]); row = Number(pm[2]); } else { col++; addr = colName(col) + row; }
    if (t.selfClosing) continue;
    const end = closeIndex(xml, "c", t.end);
    if (end < 0) break;
    const type = t.attrs.t ?? "n";
    let val: CellVal | undefined;
    if (type === "inlineStr") {
      const isStart = xml.slice(t.end, end).search(/<(?:[\w.-]+:)?is[\s>]/);
      if (isStart >= 0) val = textOfT(xml, t.end + isStart, end);
      else { const v = innerText(xml, "v", t.end, end); if (v !== null) val = decodeOoxml(v); }
    } else {
      const v = innerText(xml, "v", t.end, end);
      const hasF = innerText(xml, "f", t.end, end) !== null;
      if (v === null || (v === "" && type !== "str" && type !== "s")) val = hasF ? null : undefined; // formula w/o cached value → null; empty → skip
      else if (type === "s") val = shared[Number(v)] ?? "";
      else if (type === "str") val = decodeOoxml(v);
      else if (type === "b") val = v.trim() === "1" || v.trim().toLowerCase() === "true";
      else if (type === "e") val = v.trim();
      else if (type === "d") val = v.trim(); // ISO date string (rare; strict-mode writers)
      else val = numOrStr(v);
    }
    if (val !== undefined) out[addr] = val;
  }
  return out;
}

function colNum(c: string): number { let n = 0; for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function colName(n: number): string { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }

function addrOrder(a: string, b: string): number {
  const pa = /^([A-Z]+)(\d+)$/.exec(a), pb = /^([A-Z]+)(\d+)$/.exec(b);
  if (!pa || !pb) return a < b ? -1 : 1;
  return Number(pa[2]) - Number(pb[2]) || colNum(pa[1]) - colNum(pb[1]);
}

// ---------- public ----------
export function readXlsx(bytes: Uint8Array): ReadWorkbook {
  sniff(bytes);
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch { throw new Error(NOT_XLSX); }
  const names = Object.keys(files);
  if (names.some((n) => n === "Index/Document.iwa" || n.startsWith("Index/"))) throw new Error(NUMBERS);

  // Workbook part: usually xl/workbook.xml; follow _rels/.rels if it's elsewhere.
  let wbPath = "xl/workbook.xml";
  if (!getText(files, wbPath)) {
    const rootRels = getText(files, "_rels/.rels");
    const m = rootRels && /Target\s*=\s*"([^"]*workbook[^"]*\.xml)"/i.exec(rootRels);
    if (m) wbPath = resolveTarget("", decode(m[1]));
  }
  const wbXml = getText(files, wbPath);
  if (!wbXml) throw new Error(NOT_XLSX);
  const wbDir = wbPath.includes("/") ? wbPath.slice(0, wbPath.lastIndexOf("/")) : "";
  const relsPath = `${wbDir ? wbDir + "/" : ""}_rels/${wbPath.slice(wbPath.lastIndexOf("/") + 1)}.rels`;
  const relsXml = getText(files, relsPath) ?? "";

  const rels: Record<string, { target: string; type: string }> = {};
  for (const t of tags(relsXml)) {
    if (t.name === "Relationship" && t.attrs.Id && t.attrs.Target) {
      rels[t.attrs.Id] = { target: resolveTarget(wbDir, t.attrs.Target), type: t.attrs.Type ?? "" };
    }
  }

  let sharedPath = Object.values(rels).find((r) => /\/sharedStrings$/.test(r.type))?.target;
  if (!sharedPath || !getText(files, sharedPath)) sharedPath = `${wbDir ? wbDir + "/" : ""}sharedStrings.xml`;
  let shared: string[];
  try { shared = readSharedStrings(getText(files, sharedPath)); } catch { throw new Error(DAMAGED); }

  const sheets: Record<string, Record<string, CellVal>> = {};
  const sheetOrder: string[] = [];
  let definedId: string | null = null;
  for (const t of tags(wbXml)) {
    if (t.name === "definedName" && t.attrs.name === "thinka_id" && !t.selfClosing) {
      const end = closeIndex(wbXml, "definedName", t.end);
      const raw = end > 0 ? decode(wbXml.slice(t.end, end)).trim() : "";
      const m = /^"((?:[^"]|"")*)"$/.exec(raw);
      if (m) definedId = m[1].replace(/""/g, '"');
    }
    if (t.name !== "sheet") continue;
    const name = t.attrs.name;
    const rid = Object.entries(t.attrs).find(([k]) => k === "r:id" || /:id$/.test(k))?.[1];
    if (!name || !rid || !rels[rid]) continue;
    if (rels[rid].type && !/\/worksheet$/.test(rels[rid].type)) continue; // skip chartsheets/dialogsheets
    const xml = getText(files, rels[rid].target);
    if (xml === null) continue;
    try { sheets[name] = readSheet(xml, shared); } catch { throw new Error(DAMAGED); }
    sheetOrder.push(name);
  }
  if (!sheetOrder.length) throw new Error(DAMAGED);

  let thinkaId: string | null = null;
  outer: for (const name of sheetOrder) {
    const cells = sheets[name];
    for (const addr of Object.keys(cells).sort(addrOrder)) {
      const v = cells[addr];
      if (typeof v === "string" && v.trim().startsWith(ID_PREFIX)) { thinkaId = v.trim().slice(ID_PREFIX.length).trim(); break outer; }
    }
  }
  if (thinkaId === null && definedId) thinkaId = definedId;
  return { sheets, sheetOrder, thinkaId };
}
