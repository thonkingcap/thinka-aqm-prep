// Thinka: the mascot. A bell curve with a face, standing on two little feet.
// The shape is the normal density itself, so the logo is the course's main idea.

export type Mood = "happy" | "thinking" | "proud" | "wink";

// Bell body on a 64×64 grid: tails meet the ground at y = 50, peak at y = 9.
const BODY = "M3 50 C14 50 19.5 9 32 9 C44.5 9 50 50 61 50 Z";

function Face({ mood, ink }: { mood: Mood; ink: string }) {
  const eye = (cx: number) => {
    if (mood === "proud") return <path key={cx} d={`M${cx - 3} 30 q3 -3.4 6 0`} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />;
    if (mood === "wink" && cx > 32) return <path key={cx} d={`M${cx - 3} 29.5 h6`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />;
    const look = mood === "thinking" ? { dx: 1.2, dy: -1.4 } : { dx: 0.4, dy: 0.3 };
    return (
      <g key={cx}>
        <ellipse cx={cx} cy={29} rx={3.6} ry={4.2} fill="#fff" />
        <circle cx={cx + look.dx} cy={29 + look.dy} r={2} fill={ink} />
      </g>
    );
  };
  const mouth =
    mood === "thinking" ? <path d="M29.5 38.5 h5" stroke={ink} strokeWidth="2" strokeLinecap="round" /> :
    mood === "proud" ? <path d="M27.5 36.5 q4.5 5 9 0 z" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinejoin="round" /> :
    <path d="M28 37 q4 3.6 8 0" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />;
  return <>{eye(26.5)}{eye(37.5)}{mouth}</>;
}

/** The full character, for the gate and a few moments in the app. */
export default function Thinka({ size = 64, mood = "happy", title }: { size?: number; mood?: Mood; title?: string }) {
  const ink = "#0a0a0a";
  return (
    <svg className={`thinka thinka-${mood}`} width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {/* feet */}
      <rect x="21" y="48" width="7" height="8" rx="3.5" fill={ink} />
      <rect x="36" y="48" width="7" height="8" rx="3.5" fill={ink} />
      {/* ground shadow, a short flat dash */}
      <rect x="16" y="58.5" width="32" height="2" rx="1" fill="#d4d4d4" />
      {/* arms: resting, waving or cheering */}
      <g fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round">
        {mood === "proud" ? (
          <><path d="M16.5 35 q-5 -3 -6.5 -10" /><path d="M47.5 35 q5 -3 6.5 -10" /></>
        ) : mood === "happy" || mood === "wink" ? (
          <path d="M48 36 q5.5 -1.5 7.5 -8.5" />
        ) : null}
      </g>
      <path d={BODY} fill={ink} />
      {mood === "thinking" && (
        <g fill={ink}>
          <circle cx="50" cy="12" r="1.6" />
          <circle cx="55" cy="7.5" r="2.2" />
        </g>
      )}
      {mood === "proud" && <path d="M48 8 l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4 z" fill={ink} />}
      <Face mood={mood} ink={ink} />
    </svg>
  );
}

/** The small mark: Thinka's face in a black tile, for the rail and the wordmark. */
export function ThinkaMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0a0a0a" />
      <path d="M3 26 C9 26 11 6.5 16 6.5 S23 26 29 26 Z" fill="#fff" />
      <circle cx="13.6" cy="16.5" r="1.7" fill="#0a0a0a" />
      <circle cx="18.4" cy="16.5" r="1.7" fill="#0a0a0a" />
      <path d="M14.2 20.6 q1.8 1.6 3.6 0" fill="none" stroke="#0a0a0a" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
