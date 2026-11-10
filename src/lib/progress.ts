// Practice history, kept in this browser only.
export type Attempt = { kind: string; topic: string; caseKey?: string; correct: number; total: number; ts: number };

const KEY = "aqm.progress.v1";
const EXAM_KEY = "aqm.examDate";
export const DEFAULT_EXAM = "2026-11-18";

export function readAttempts(): Attempt[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Attempt[]; } catch { return []; }
}

export function addAttempt(a: Attempt) {
  const all = readAttempts();
  all.push(a);
  try { localStorage.setItem(KEY, JSON.stringify(all.slice(-500))); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("aqm:progress"));
}

export function clearAttempts() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("aqm:progress"));
}

export function examDate(): string {
  try { return localStorage.getItem(EXAM_KEY) || DEFAULT_EXAM; } catch { return DEFAULT_EXAM; }
}

export function setExamDate(d: string) {
  try { localStorage.setItem(EXAM_KEY, d); } catch { /* ignore */ }
}

/** Whole days from today to the exam (0 on exam day). */
export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const exam = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((exam.getTime() - today.getTime()) / 86_400_000);
}

export type TopicStat = { topic: string; correct: number; total: number; questions: number };

export function statsByTopic(attempts: Attempt[]): Map<string, TopicStat> {
  const m = new Map<string, TopicStat>();
  for (const a of attempts) {
    const s = m.get(a.topic) ?? { topic: a.topic, correct: 0, total: 0, questions: 0 };
    s.correct += a.correct;
    s.total += a.total;
    s.questions += 1;
    m.set(a.topic, s);
  }
  return m;
}

export function statsByCase(attempts: Attempt[]): Map<string, { correct: number; total: number }> {
  const m = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    if (!a.caseKey) continue;
    const s = m.get(a.caseKey) ?? { correct: 0, total: 0 };
    s.correct += a.correct;
    s.total += a.total;
    m.set(a.caseKey, s);
  }
  return m;
}
