import { useState } from "react";
import { BookOpen, FlaskConical, House, KeyRound, LifeBuoy, ListChecks, MessageSquare, PencilLine } from "lucide-react";
import ProblemDialog from "./components/ProblemDialog.tsx";
import { useSession, useRoute } from "./session.tsx";
import Gate from "./screens/Gate.tsx";
import Home from "./screens/Home.tsx";
import Learn from "./screens/Learn.tsx";
import Lab from "./screens/Lab.tsx";
import Practice from "./screens/Practice.tsx";
import Tutor from "./screens/Tutor.tsx";
import KeySettings from "./screens/KeySettings.tsx";
import Plan from "./screens/Plan.tsx";
import Sets from "./screens/Sets.tsx";
import Mocks from "./screens/Mocks.tsx";
import { ThinkaMark } from "./components/Thinka.tsx";

const NAV = [
  { id: "home", label: "Home", icon: House },
  { id: "plan", label: "Plan", icon: ListChecks },
  { id: "learn", label: "Learn", icon: BookOpen },
  { id: "lab", label: "Test lab", icon: FlaskConical },
  { id: "practice", label: "Practice", icon: PencilLine },
  { id: "tutor", label: "Tutor", icon: MessageSquare },
];

export function Mark({ size = 32 }: { size?: number }) {
  return <ThinkaMark size={size} />;
}

export default function App() {
  const { apiKey, browsing, ready } = useSession();
  const route = useRoute();
  const screen = route[0] ?? "home";
  const [problem, setProblem] = useState(false);

  if (!ready) return <div className="boot" aria-busy="true" />;
  if (!apiKey && !browsing && screen !== "key") return <Gate />;

  let body;
  switch (screen) {
    case "plan": body = <Plan sub={route[1]} />; break;
    case "learn": body = <Learn topicId={route[1]} />; break;
    case "lab": body = <Lab />; break;
    case "practice": body = route[1] === "sets" ? <Sets n={route[2]} /> : route[1] === "mocks" ? <Mocks n={route[2]} /> : <Practice initial={route[1]} />; break;
    case "tutor": body = <Tutor />; break;
    case "key": body = <KeySettings />; break;
    default: body = <Home />;
  }

  return (
    <div className="app">
      <nav className="rail" aria-label="Main">
        <a className="rail-mark" href="#/home" aria-label="Thinka's AQM Prep home"><Mark /></a>
        {NAV.map(({ id, label, icon: Icon }) => (
          <a key={id} className="rail-link" href={`#/${id}`} aria-label={label} aria-current={screen === id ? "page" : undefined}>
            <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
            <span className="rail-label" aria-hidden="true">{label}</span>
            <span className="rail-tip" aria-hidden="true">{label}</span>
          </a>
        ))}
        <div className="rail-bottom">
          <span className="rail-sep" aria-hidden="true" />
          <button type="button" className="rail-link rail-btn" onClick={() => setProblem(true)} aria-label="Have a problem? Message the developer">
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
      <main className="main" id="main">{body}</main>
      <ProblemDialog open={problem} onClose={() => setProblem(false)} />
    </div>
  );
}
