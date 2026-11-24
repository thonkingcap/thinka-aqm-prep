// The Word question paper for a practice exam, formatted like the professor's Exam 3 paper.
// public/exam-paper-template.docx is his paper's styles, numbering, page setup (landscape, two
// columns, page numbers in the footer) and pooled-t formula box, with the questions removed. This
// fills in the questions in his run formatting: Times New Roman 11pt, underlined section headings
// with italic [points], questions on Word's own numbered list, H₀ with a real subscript.
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import type { Paper } from "./paper.ts";
import { BASE } from "./base.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Fmt = { b?: boolean; i?: boolean; u?: boolean; va?: "subscript" | "superscript" };
const rPr = (f: Fmt) =>
  `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${f.b ? "<w:b/><w:bCs/>" : ""}${f.i ? "<w:i/><w:iCs/>" : ""}<w:sz w:val="22"/><w:szCs w:val="22"/>${f.u ? `<w:u w:val="single"/>` : ""}${f.va ? `<w:vertAlign w:val="${f.va}"/>` : ""}</w:rPr>`;
const run = (t: string, f: Fmt = {}) => (t ? `<w:r>${rPr(f)}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>` : "");

// x̄ as a Word equation, as on the professor's paper.
const XBAR = `<m:oMath><m:acc><m:accPr><m:chr m:val="̅"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" w:cs="Times New Roman"/><w:i/><w:iCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></m:ctrlPr></m:accPr><m:e><m:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" w:cs="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><m:t>X</m:t></m:r></m:e></m:acc></m:oMath>`;

/** Markup (see paper.ts) to Word runs: **bold**, *italic*, _{sub}, ^{sup}, {xbar}. */
export function runs(markup: string, base: Fmt = {}): string {
  let out = "", b = !!base.b, i = !!base.i;
  for (const tok of markup.split(/(\*\*|\*|_\{[^}]*\}|\^\{[^}]*\}|\{xbar\})/)) {
    if (!tok) continue;
    if (tok === "**") { b = !b; continue; }
    if (tok === "*") { i = !i; continue; }
    if (tok === "{xbar}") { out += XBAR; continue; }
    const f: Fmt = { ...base, b, i };
    if (tok.startsWith("_{")) out += run(tok.slice(2, -1), { ...f, va: "subscript" });
    else if (tok.startsWith("^{")) out += run(tok.slice(2, -1), { ...f, va: "superscript" });
    else out += run(tok, f);
  }
  return out;
}

const para = (pPrFmt: Fmt, body: string, list = false) =>
  `<w:p><w:pPr>${list ? `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="8"/></w:numPr>` : ""}${rPr(pPrFmt)}</w:pPr>${body}</w:p>`;
const empty = () => para({}, "");

/** The question paper's document.xml body paragraphs (without the page setup). */
export function paperParagraphs(P: Pick<Paper, "header" | "sections"> & { instructions?: string[] }, formulaBox: string): string {
  const out: string[] = [para({ b: true }, run(P.header, { b: true }))];
  if (P.instructions?.length) {
    out.push(para({ b: true }, run("Instructions", { b: true })));
    for (const line of P.instructions) out.push(para({}, runs(line)));
    out.push(empty());
  }
  P.sections.forEach((s, k) => {
    out.push(para({ i: true }, run(`${k + 1}. ${s.title}${s.points ? " " : ""}`, { u: true }) + (s.points ? run(`[${s.points} points]`, { i: true, u: true }) : "")));
    for (const it of s.items) {
      if (it.kind === "lead") out.push(para({}, runs(it.text)));
      else if (it.kind === "q") out.push(para({}, runs(it.text) + run(" ") + run(`[${it.points}]`, { i: true }), true));
      else out.push(formulaBox, empty(), empty(), empty(), empty(), empty());
    }
  });
  out.push(empty(), para({ b: true }, run("End of exam", { b: true })), empty());
  return out.join("");
}

/** Builds the .docx from the template's bytes. */
export function buildPaperDocx(P: Pick<Paper, "header" | "sections"> & { instructions?: string[] }, template: Uint8Array): Uint8Array {
  const files = unzipSync(template);
  const doc = strFromU8(files["word/document.xml"]);
  const open = doc.indexOf("<w:body>") + "<w:body>".length;
  const sect = doc.lastIndexOf("<w:sectPr");
  if (open < 8 || sect < open) throw new Error("The Word template is damaged. Reload the page and try again.");
  const head = doc.slice(0, open), formulaBox = doc.slice(open, sect), tail = doc.slice(sect);
  files["word/document.xml"] = strToU8(head + paperParagraphs(P, formulaBox) + tail);
  files["docProps/core.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(P.header)}</dc:title><dc:creator>AQM Prep</dc:creator><cp:lastModifiedBy>AQM Prep</cp:lastModifiedBy></cp:coreProperties>`);
  return zipSync(files, { level: 6 });
}

export const TEMPLATE_URL = `${BASE}exam-paper-template.docx`;
