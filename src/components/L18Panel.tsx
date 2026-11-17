// Lesson 18 practice sets, laid out like the Lesson 18 notes' exercises (variance test + Toolpak two-sample).
import { Download } from "lucide-react";
import { L18_COUNT, l18Id } from "../lib/l18.ts";
import { downloadL18 } from "../lib/download.ts";
import type { SavedScore } from "./UploadGrade.tsx";
import "../screens/home.css";

export default function L18Panel({ scores, id = "l18" }: { scores: Record<string, SavedScore>; id?: string }) {
  return (
    <section className="panel" aria-labelledby={`${id}-h`} id={id}>
      <div className="panel-head"><h2 id={`${id}-h`}>Lesson 18 practice</h2><span className="hint">Like the Lesson 18 notes' exercises</span></div>
      <p className="hint home-lead">Each set mirrors the two Lesson 18 exercises with new data: a chi-squared test on a variance (plus a bonus on the other tail) and the Toolpak two-sample z-test with known σ (plus a bonus with the equal-variance t-test). The decisions differ from set to set; set 6 uses the notes' own setup. Answer key on the second tab; upload the finished file in any upload box to have it marked.</p>
      <div className="home-mocks stagger">
        {Array.from({ length: L18_COUNT }, (_, k) => k + 1).map((n) => {
          const s = scores[l18Id(n)];
          return (
            <div key={n} className="home-mock lift">
              <b>Set {n}</b>
              <span className="hint num">{s ? `Best ${Math.round(s.best * 10) / 10}/${s.total}` : "Not tried yet"}</span>
              <button className="btn btn-ghost btn-small" onClick={() => downloadL18(n)} aria-label={`Download Lesson 18 practice set ${n}`}><Download size={13} aria-hidden="true" />Download</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
