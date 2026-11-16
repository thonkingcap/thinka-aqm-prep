// Old practice links (#/practice/..., #/plan/...) from before the site was split into the exam's four
// areas: send them to the matching area page, Exam 3, or Home.
import { useEffect } from "react";
import { topicForKind } from "../lib/sets.ts";

/** Old topic set → the area that practises it now. */
const TOPIC_AREA: Record<string, string> = {
  normal: "ci", sampling: "ci", intervals: "ci",
  "one-sample": "ht1", concepts: "ht1",
  variance: "ht2",
  "two-sample": "two",
};

export function legacyTarget(route: string[]): string {
  const [screen, a, b, c] = route;
  if (screen === "plan") return a === "check" ? "#/exam3" : "#/home";
  // #/practice/...
  if (!a || a === "mixed" || a === "sets" || a === "custom") return "#/home";
  if (a === "mocks") return "#/home";
  if (a === "topic" && b) {
    const area = TOPIC_AREA[b];
    if (!area) return "#/home";
    const v = Number(c);
    return v >= 1 && v <= 4 ? `#/area/${area}/set/${v}` : `#/area/${area}`;
  }
  const area = TOPIC_AREA[topicForKind(a)];
  return area ? `#/area/${area}` : "#/home";
}

export default function Practice({ route }: { route: string[] }) {
  useEffect(() => { location.replace(legacyTarget(route)); }, [route]);
  return null;
}
