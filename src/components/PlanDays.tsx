// The day-by-day study plan (built in plan.ts from the marked Exam 3), with tick boxes.
import { MessageSquare } from "lucide-react";
import { setDone, type PlanDay } from "../lib/plan.ts";
import { useSession } from "../session.tsx";
import "./planDays.css";

export function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function DayRow({ d, done, today }: { d: PlanDay; done: Record<string, boolean>; today: string }) {
  const { askTutor } = useSession();
  const past = d.date < today;
  const isToday = d.date === today;
  const allDone = d.tasks.every((_, i) => done[`${d.date}:${i}`]);
  return (
    <li className={`day${isToday ? " today" : ""}${past && !allDone ? " missed" : ""}${allDone ? " complete" : ""}`} id={isToday ? "today" : undefined}>
      <div className="day-date">
        <span className="num">{dayLabel(d.date)}</span>
        {isToday && <span className="pill pill-neutral">Today</span>}
      </div>
      <div className="day-body">
        <h3>{d.title}</h3>
        <p className="hint">{d.why}</p>
        <ul className="tasks">
          {d.tasks.map((t, i) => {
            const id = `${d.date}:${i}`;
            return (
              <li key={id}>
                <label className="check task-check">
                  <input type="checkbox" checked={!!done[id]} onChange={(e) => setDone(id, e.target.checked)} aria-label={`Mark done: ${t.label}`} />
                </label>
                {t.kind === "tutor" ? (
                  <button className="task-link linkbtn" onClick={() => askTutor(t.tutorPrompt!)}><MessageSquare size={14} aria-hidden="true" />{t.label}</button>
                ) : (
                  <a className="task-link" href={t.href}>{t.label}</a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}
