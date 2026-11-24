// What a student has done on the Lessons pages, on this device: best quick-check score per lesson (and
// for the unit/final mixed quizzes), and the last lesson they opened (for "carry on" on Home).
const KEY = "aqm.lessons.v1";
type Store = { quiz: Record<string, { best: number; total: number; ts: number }>; last?: { n: number; title?: string; ts: number } };

function read(): Store {
  try { return { quiz: {}, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Store>) }; } catch { return { quiz: {} }; }
}
function write(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private window: progress just isn't kept */ }
  window.dispatchEvent(new CustomEvent("aqm:lessons"));
}
/** Quiz ids: "lesson:7", "unit:1", "final". */
export function saveQuiz(id: string, got: number, total: number) {
  const s = read();
  const prev = s.quiz[id];
  const better = !prev || got / total > prev.best / prev.total;
  s.quiz[id] = better ? { best: got, total, ts: Date.now() } : { ...prev, ts: Date.now() };
  write(s);
}
export const quizBest = (id: string) => read().quiz[id] ?? null;
export function markOpened(n: number, title?: string) {
  const s = read();
  s.last = { n, title, ts: Date.now() };
  write(s);
}
export const lastLesson = () => read().last ?? null;
