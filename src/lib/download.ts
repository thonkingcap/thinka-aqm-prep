// Builds and downloads a practice workbook (any id from sets.ts) as .xlsx.
import { buildXlsx, downloadXlsx } from "./xlsx.ts";
import { workbookById, workbookSheets, workbookIntro, type WorkbookDef } from "./sets.ts";

export function downloadWorkbook(def: WorkbookDef) {
  const bytes = buildXlsx(workbookSheets(def), { title: `AQM Prep · ${def.title}`, intro: workbookIntro(def), id: def.id });
  downloadXlsx(bytes, `${def.file}.xlsx`);
}

export function downloadById(id: string) {
  const d = workbookById(id);
  if (d) downloadWorkbook(d);
}
