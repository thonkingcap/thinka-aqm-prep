// A quick check: one multiple-choice question at a time, instant feedback with the reason, a score at the end.
// Options are shuffled each attempt so the right answer isn't always in the same place.
import { useMemo, useState } from "react";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import type { QuizQ } from "../lib/lessons/types.ts";
import { saveQuiz, quizBest } from "../lib/lessons/progress.ts";
import "./quiz.css";

export type QuizItem = QuizQ & { from?: string };

function shuffled<T>(xs: T[], seed: number): T[] {
  const a = [...xs];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Quiz({ id, items, pick }: { id: string; items: QuizItem[]; pick?: number }) {
  const [round, setRound] = useState(() => Date.now() % 100000);
  const qs = useMemo(() => {
    const chosen = pick && items.length > pick ? shuffled(items, round).slice(0, pick) : items;
    return chosen.map((q, k) => {
      const order = shuffled(q.options.map((_, i) => i), round + k * 7);
      return { ...q, order };
    });
  }, [items, pick, round]);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const best = quizBest(id);

  if (!qs.length) return <p className="hint">No questions yet.</p>;

  function choose(opt: number) {
    if (chosen !== null) return;
    setChosen(opt);
    if (opt === qs[i].answer) setScore((s) => s + 1);
  }
  function next() {
    if (i + 1 >= qs.length) {
      const final = score;
      saveQuiz(id, final, qs.length);
      setDone(true);
      return;
    }
    setI(i + 1);
    setChosen(null);
  }
  function again() {
    setRound((r) => r + 1); setI(0); setChosen(null); setScore(0); setDone(false);
  }

  if (done) {
    const pct = Math.round((100 * score) / qs.length);
    return (
      <div className="quiz quiz-done" role="status">
        <p className="quiz-score num"><b>{score}</b> / {qs.length}</p>
        <p>{pct === 100 ? "All right. Nicely done." : pct >= 70 ? "Good. Read the ones you missed once more." : "Worth another read of the definitions, then try again."}</p>
        {best && <p className="hint num">Best so far: {best.best}/{best.total}</p>}
        <button className="btn btn-primary btn-small" onClick={again}><RotateCcw size={14} aria-hidden="true" />Try again{pick ? " (new questions)" : " (shuffled)"}</button>
      </div>
    );
  }

  const q = qs[i];
  const answered = chosen !== null;
  return (
    <div className="quiz">
      <div className="quiz-top">
        <span className="hint num">Question {i + 1} of {qs.length}{q.from ? ` · ${q.from}` : ""}</span>
        <span className="quiz-dots" aria-hidden="true">{qs.map((_, k) => <span key={k} className={k < i ? "done" : k === i ? "on" : ""} />)}</span>
      </div>
      <p className="quiz-q">{q.q}</p>
      <div className="quiz-opts" role="group" aria-label="Choose an answer">
        {q.order.map((o) => {
          const right = o === q.answer, picked = o === chosen;
          const cls = !answered ? "" : right ? " is-right" : picked ? " is-wrong" : " is-dim";
          return (
            <button key={o} type="button" className={`quiz-opt${cls}`} onClick={() => choose(o)} disabled={answered && !picked && !right} aria-pressed={picked}>
              <span className="quiz-mark" aria-hidden="true">{answered && right ? <Check size={14} /> : answered && picked ? <X size={14} /> : null}</span>
              <span>{q.options[o]}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`quiz-why ${chosen === q.answer ? "ok" : "no"}`} role="status">
          <b>{chosen === q.answer ? "Right." : "Not quite."}</b> {q.why}
        </div>
      )}
      <div className="quiz-foot">
        <button className="btn btn-primary btn-small" onClick={next} disabled={!answered}>{i + 1 >= qs.length ? "See my score" : "Next"}<ArrowRight size={14} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
