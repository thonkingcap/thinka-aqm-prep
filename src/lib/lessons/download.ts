// Downloads for the Lessons / Units / Final workbooks (kept apart from lib/download.ts so the lessons load on demand).
import { buildXlsx, downloadXlsx } from "../xlsx.ts";
import { bookFiles } from "./books.ts";

/** A workbook (ids les:, unit:, final:), or its answer key with live formulas. */
export function downloadBook(id: string, key = false) {
  const f = bookFiles(id);
  if (!f) return;
  const sheets = key ? f.key : f.sheets;
  const intro = key ? ["ANSWER KEY: every yellow cell holds the formula that gets the answer, with a note on why at the bottom of each tab.", ...f.book.intro.slice(0, 1)] : f.book.intro;
  downloadXlsx(buildXlsx(sheets, { title: `AQM Prep · ${f.book.title}${key ? " · answer key" : ""}`, intro, id: f.book.id }), `${f.book.file}${key ? "-answer-key" : ""}.xlsx`);
}
