import { useEffect, useState, type JSX, type ReactNode } from "react";
import { CircleHelp, FileSpreadsheet, House, KeyRound, LifeBuoy } from "lucide-react";
import ProblemDialog from "./components/ProblemDialog.tsx";
import { useSession, useRoute } from "./session.tsx";
import Gate from "./screens/Gate.tsx";
import Home from "./screens/Home.tsx";
import Learn from "./screens/Learn.tsx";
import Lab from "./screens/Lab.tsx";
import Practice from "./screens/Practice.tsx";
import Tutor from "./screens/Tutor.tsx";
import KeySettings from "./screens/KeySettings.tsx";
import Area from "./screens/Area.tsx";
import Exam3 from "./screens/Exam3.tsx";
import Admin from "./screens/Admin.tsx";
import Walkthrough, { openHowTo } from "./components/Walkthrough.tsx";
import { AREAS } from "./lib/areas.ts";
import DrPhil from "./components/DrPhil.tsx";
const DrPhilIcon = ({ size = 18 }: { size?: number; strokeWidth?: number }) => <DrPhil size={size + 6} />;
import { ThinkaMark } from "./components/Thinka.tsx";
import { useOnline } from "./lib/online.ts";
import NamePrompt, { useNeedsName } from "./components/NamePrompt.tsx";
import { startUsageClock } from "./lib/usage.ts";

startUsageClock();

/** Nav: Home, Exam 3, the exam's four areas (numbered), the tutor. `tiny` is the phone label. */
const MOBILE: Record<string, string> = { ci: "CIs", ht1: "Tests I", ht2: "Tests II", two: "Two-sam." };
const NAV: { href: string; label: string; tiny: string; match: (r: string[]) => boolean; icon?: typeof House | ((p: { size?: number; strokeWidth?: number }) => JSX.Element); n?: number }[] = [
  { href: "#/home", label: "Home", tiny: "Home", icon: House, match: (r) => !r[0] || r[0] === "home" },
  { href: "#/exam3", label: "Exam 3: start here", tiny: "Exam 3", icon: FileSpreadsheet, match: (r) => r[0] === "exam3" },
  ...AREAS.map((a) => ({ href: `#/area/${a.id}`, label: `${a.n}. ${a.title}`, tiny: MOBILE[a.id] ?? a.short, n: a.n, match: (r: string[]) => r[0] === "area" && r[1] === a.id })),
  { href: "#/tutor", label: "Dr Phil (AI tutor)", tiny: "Dr Phil", icon: DrPhilIcon, match: (r) => r[0] === "tutor" },
];

export function Mark({ size = 32 }: { size?: number }) {
  return <ThinkaMark size={size} />;
}

export default function App() {
  const { apiKey, browsing, ready } = useSession();
  const route = useRoute();
  const screen = route[0] ?? "home";
  const [problem, setProblem] = useState(false);
  const online = useOnline();
  const needsName = useNeedsName();
  // #/home/mocks and the like: scroll to that section of Home.
  useEffect(() => {
    if (screen !== "home" || !route[1]) return;
    const t = window.setTimeout(() => document.getElementById(route[1])?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => window.clearTimeout(t);
  }, [screen, route[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <div className="boot" aria-busy="true" />;
  if (screen === "admin") return <main className="main" id="main"><Admin /></main>;
  if (!apiKey && !browsing && screen !== "key") return <>{needsName && <NamePrompt />}<Gate /></>;

  let body: ReactNode;
  switch (screen) {
    case "exam3": body = <Exam3 />; break;
    case "admin": body = <Admin />; break;
    case "area": body = <Area id={route[1]} route={route.slice(2)} />; break;
    case "learn": body = <Learn topicId={route[1]} />; break;
    case "lab": body = <Lab />; break;
    case "plan": case "practice": body = <Practice route={route} />; break; // old links
    case "home": break;
    case "tutor": body = <Tutor />; break;
    case "key": body = <KeySettings />; break;
  }
  body ??= <Home />;

  return (
    <div className="app">
      <nav className="rail" aria-label="Main">
        <a className="rail-mark" href="#/home" aria-label="AQM Prep home"><Mark /></a>
        {NAV.map(({ href, label, tiny, match, icon: Icon, n }, i) => (
          <a key={href} className={`rail-link${n ? " rail-area" : ""}${i === 2 ? " rail-first-area" : ""}`} href={href} aria-label={label} aria-current={match(route) ? "page" : undefined}>
            {Icon ? <Icon size={18} strokeWidth={1.6} aria-hidden="true" /> : <span className="rail-num" aria-hidden="true">{n}</span>}
            <span className="rail-label" aria-hidden="true">{tiny}</span>
            <span className="rail-tip" aria-hidden="true">{label}</span>
          </a>
        ))}
        <div className="rail-bottom">
          <span className="rail-sep" aria-hidden="true" />
          <button type="button" className="rail-link rail-btn rail-desk" onClick={openHowTo} aria-label="How to use this site">
            <CircleHelp size={18} strokeWidth={1.6} aria-hidden="true" />
            <span className="rail-label" aria-hidden="true">How to</span>
            <span className="rail-tip" aria-hidden="true">How to use this site</span>
          </button>
          <button type="button" className="rail-link rail-btn rail-desk" onClick={() => setProblem(true)} aria-label="Have a problem? Message the developer">
            <LifeBuoy size={18} strokeWidth={1.6} aria-hidden="true" />
            <span className="rail-label" aria-hidden="true">Help</span>
            <span className="rail-tip" aria-hidden="true">Have a problem?</span>
          </button>
          <a className="rail-link" href="#/key" aria-label={apiKey ? "API key and balance (key active)" : "API key and balance (no key)"} aria-current={screen === "key" ? "page" : undefined}>
            <KeyRound size={18} strokeWidth={1.6} aria-hidden="true" />
            <span className={`rail-dot${apiKey ? " on" : ""}`} aria-hidden="true" />
            <span className="rail-label" aria-hidden="true">Key</span>
            <span className="rail-tip" aria-hidden="true">{apiKey ? "API key and balance" : "Add your API key"}</span>
          </a>
        </div>
      </nav>
      <main className="main" id="main">
        {!online && <p className="offline-bar" role="status">You're offline. Notes, workbook downloads and marking all still work; Dr Phil and the Claude features come back when you reconnect.</p>}
        <div className="route" key={route.join("/")}>{body}</div>
      </main>
      <ProblemDialog open={problem} onClose={() => setProblem(false)} />
      {needsName ? <NamePrompt /> : <Walkthrough />}
    </div>
  );
}
