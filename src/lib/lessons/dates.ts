// Course dates from the Fall 2026 syllabus.
export const FINAL_ISO = "2026-12-16";
export const finalDate = () => FINAL_ISO;
/** Whole days from today (local) to an ISO date; negative once it has passed. */
export function daysTo(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - t.getTime()) / 86_400_000);
}
