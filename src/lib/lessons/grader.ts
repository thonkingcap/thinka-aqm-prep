// The on-demand marker for Lessons / Units / Final workbooks (les:, unit:, final:) and diagnostics (dx:).
import type { ReadWorkbook } from "../xlsxRead.ts";
import type { WorkbookGrade } from "../grade.ts";
import { gradeBook } from "./books.ts";
import { lessonByN } from "./index.ts";
import { diagById } from "../diag/index.ts";
import { gradeDiag } from "../diag/mark.ts";

export function gradeAny(wb: ReadWorkbook): WorkbookGrade {
  const id = (wb.thinkaId ?? "").trim();
  let g: WorkbookGrade;
  if (id.startsWith("dx:")) {
    const P = diagById(id);
    if (!P) throw new Error("This diagnostic isn't one the site knows. Download it again from the site.");
    g = gradeDiag(wb, P);
  } else g = gradeBook(wb);
  // Name each lesson in the report ("Lesson 8: Linear models…") where it reports by lesson.
  for (const q of g.questions) {
    const n = /^lesson:(\d+)$/.exec(q.q.topic)?.[1];
    const L = n ? lessonByN(Number(n)) : null;
    if (L) q.q = { ...q.q, topic: `lesson:${L.n}:Lesson ${L.n}: ${L.title}` as typeof q.q.topic };
  }
  return g;
}
