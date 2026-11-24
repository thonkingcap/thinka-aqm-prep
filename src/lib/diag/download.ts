// Downloads for the diagnostics: the workbook, its answer key, and the Word question paper.
import { buildXlsx, downloadXlsx } from "../xlsx.ts";
import { buildPaperDocx, TEMPLATE_URL } from "../docx.ts";
import { paperSheets, wordPaper } from "./kit.ts";
import { diagById } from "./index.ts";

export function downloadDiag(id: string, key = false) {
  const P = diagById(id);
  if (!P) return;
  downloadXlsx(buildXlsx(paperSheets(P, key), { title: `${P.header}${key ? ": answer key" : ""}`, id: P.id, look: "exam" }), `${P.file}${key ? "-answer-key" : ""}.xlsx`);
}

export async function downloadDiagDocx(id: string) {
  const P = diagById(id);
  if (!P) return;
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error("Couldn't load the Word template. Check your connection and try again.");
  const bytes = buildPaperDocx({ ...wordPaper(P), instructions: P.instructions }, new Uint8Array(await res.arrayBuffer()));
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${P.file}.docx`; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
