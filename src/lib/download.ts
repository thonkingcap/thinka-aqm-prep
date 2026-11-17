// Builds and downloads a practice workbook (any id from sets.ts) as .xlsx.
import { buildXlsx, downloadXlsx } from "./xlsx.ts";
import { workbookById, workbookSheets, workbookIntro, type WorkbookDef } from "./sets.ts";
import { paper } from "./paper.ts";
import { buildPaperDocx, TEMPLATE_URL } from "./docx.ts";

export function downloadWorkbook(def: WorkbookDef) {
  const bytes = buildXlsx(workbookSheets(def), { title: `AQM Prep · ${def.title}`, intro: workbookIntro(def), id: def.id });
  downloadXlsx(bytes, `${def.file}.xlsx`);
}

export function downloadById(id: string) {
  const d = workbookById(id);
  if (d) downloadWorkbook(d);
}

// ---------- practice exams in the Exam 3 format ----------
function saveBlob(bytes: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The blank workbook (what students fill in), laid out like the professor's. */
export function downloadPaperWorkbook(n: number) {
  const P = paper(n);
  if (P) downloadXlsx(buildXlsx(P.sheets, { title: P.header, id: P.id, look: "exam" }), `${P.file}.xlsx`);
}

/** The same tabs with every answer as a live Excel formula (and the model written answers). */
export function downloadPaperKey(n: number) {
  const P = paper(n);
  if (P) downloadXlsx(buildXlsx(P.key, { title: `${P.header}: answer key`, id: P.id, look: "exam" }), `${P.file}-answer-key.xlsx`);
}

/** The Word question paper. Fetches the template (cached by the service worker for offline use). */
export async function downloadPaperDocx(n: number) {
  const P = paper(n);
  if (!P) return;
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error("Couldn't load the Word template. Check your connection and try again.");
  const bytes = buildPaperDocx(P, new Uint8Array(await res.arrayBuffer()));
  saveBlob(bytes, `${P.file}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}
