// Minimal .xlsx (SpreadsheetML) writer for the problem-set workbooks. No sharedStrings:
// every string is an inline string. Zipped with fflate.
import { zipSync, strToU8 } from "fflate";
import type { Cell, CellRole, SheetModel } from "./workbook.ts";

// ---------- text helpers ----------
// Characters allowed in XML 1.0: tab, LF, CR, U+0020–U+D7FF, U+E000–U+FFFD, U+10000–U+10FFFF.
// With the u flag, unpaired surrogates are single code points outside these ranges, so they go too.
const INVALID_XML = new RegExp("[^\\t\\n\\r\\u0020-\\uD7FF\\uE000-\\uFFFD\\u{10000}-\\u{10FFFF}]", "gu");

function esc(s: string): string {
  return s
    .replace(INVALID_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const MAX_CELL_TEXT = 32767;

function sheetName(raw: string, used: Set<string>): string {
  let base = raw.replace(INVALID_XML, "").replace(/[[\]:*?/\\]/g, "-").replace(/^'+|'+$/g, "").trim();
  if (!base) base = "Sheet";
  base = base.slice(0, 31);
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) {
    const suffix = ` (${i})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

function colToNum(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseAddr(addr: string): { col: number; row: number } | null {
  const m = /^([A-Z]{1,3})([1-9]\d*)$/.exec(addr.toUpperCase());
  return m ? { col: colToNum(m[1]), row: Number(m[2]) } : null;
}

// ---------- styles ----------
// cellXfs indices
const XF = { normal: 0, title: 1, header: 2, pct: 3, answer: 4, hint: 5, answerPct: 6, tiny: 7 } as const;

// Writer-internal cell: may force a style (used for the small grey id stamp).
type XCell = Cell & { xf?: number };

function styleFor(c: XCell): number {
  if (c.xf !== undefined) return c.xf;
  const role: CellRole | undefined = c.role;
  if (role === "title") return XF.title;
  if (role === "header") return XF.header;
  if (role === "answer") return c.pct ? XF.answerPct : XF.answer;
  if (role === "hint") return XF.hint;
  if (c.pct && typeof c.v === "number") return XF.pct;
  return XF.normal; // text, label, given, data
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="5">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
<font><b/><sz val="14"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
<font><i/><sz val="11"/><color rgb="FF7F7F7F"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
<font><sz val="8"/><color rgb="FFBFBFBF"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="10" fontId="0" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="0"/>
<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;

// ---------- worksheet ----------
function cellXml(addr: string, c: XCell): string {
  const s = styleFor(c);
  const sAttr = s ? ` s="${s}"` : "";
  if (typeof c.v === "number" && Number.isFinite(c.v)) return `<c r="${addr}"${sAttr}><v>${String(c.v)}</v></c>`;
  if (typeof c.v === "string" && c.v !== "") {
    const text = esc(c.v.slice(0, MAX_CELL_TEXT));
    return `<c r="${addr}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
  }
  return s ? `<c r="${addr}"${sAttr}/>` : "";
}

function sheetXml(m: SheetModel, active: boolean): string {
  const rows = new Map<number, { col: number; xml: string }[]>();
  for (const [rawAddr, c] of Object.entries(m.cells)) {
    const p = parseAddr(rawAddr);
    if (!p) continue;
    const xml = cellXml(rawAddr.toUpperCase(), c);
    if (!xml) continue;
    if (!rows.has(p.row)) rows.set(p.row, []);
    rows.get(p.row)!.push({ col: p.col, xml });
  }
  const rowXml = [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([r, cs]) => `<row r="${r}">${cs.sort((a, b) => a.col - b.col).map((x) => x.xml).join("")}</row>`)
    .join("");
  const cols = m.colWidths.length
    ? `<cols>${m.colWidths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Number.isFinite(w) && w > 0 ? w : 8.43}" customWidth="1"/>`)
        .join("")}</cols>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"${active ? ` tabSelected="1"` : ""}/></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${cols}<sheetData>${rowXml}</sheetData>
<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`;
}

export const THINKA_ID_PREFIX = "thinka-id:";
export const THINKA_ID_CELL = "A60";

function startSheet(title: string, intro: string[], id?: string): SheetModel {
  const cells: Record<string, XCell> = { A1: { v: title, role: "title" } };
  let r = 3;
  for (const line of intro) cells[`A${r++}`] = { v: line, role: "text" };
  if (intro.length) r++;
  cells[`A${r}`] = { role: "answer" };
  cells[`B${r}`] = { v: "Answer cells: type your answer or a formula here", role: "label" };
  r += 2;
  cells[`A${r}`] = { v: "Then enter your answers on the site to check them.", role: "text" };
  if (id) cells[THINKA_ID_CELL] = { v: THINKA_ID_PREFIX + id, xf: XF.tiny };
  return { name: "Start here", cells, colWidths: [12, 60], answerCells: {}, rows: r };
}

// ---------- package ----------
export function buildXlsx(sheets: SheetModel[], opts: { title: string; intro?: string[]; id?: string }): Uint8Array {
  const all = [startSheet(opts.title, opts.intro ?? [], opts.id), ...sheets];
  const used = new Set<string>();
  const names = all.map((s) => sheetName(s.name, used));
  const n = all.length;
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const files: Record<string, Uint8Array> = {};
  const put = (path: string, xml: string) => { files[path] = strToU8(xml); };

  put("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

  put("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

  put("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>Microsoft Excel</Application>
<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${n}</vt:i4></vt:variant></vt:vector></HeadingPairs>
<TitlesOfParts><vt:vector size="${n}" baseType="lpstr">${names.map((s) => `<vt:lpstr>${esc(s)}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts>
</Properties>`);

  put("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${esc(opts.title)}</dc:title>
<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`);

  put("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView activeTab="0"/></bookViews>
<sheets>${names.map((s, i) => `<sheet name="${esc(s)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
${opts.id && opts.id.length <= 200 ? `<definedNames><definedName name="thinka_id" hidden="1">${esc(`"${opts.id.replace(/"/g, '""')}"`)}</definedName></definedNames>\n` : ""}</workbook>`);

  put("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  put("xl/styles.xml", STYLES);
  all.forEach((s, i) => put(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s, i === 0)));

  return zipSync(files, { level: 6 });
}

export function downloadXlsx(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
