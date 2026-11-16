// The tutor's avatar: a cartoon of Dr Phil (made at his request): short dark swept hair, dark
// rectangular glasses, a short beard and a denim jacket. Plain SVG, so it's crisp at any size.
import { useId } from "react";

export default function DrPhil({ size = 40, title }: { size?: number; title?: string; strokeWidth?: number }) {
  const clip = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} className="drphil">
      <defs>
        <clipPath id={clip}><circle cx="32" cy="32" r="32" /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="64" height="64" fill="#e9edf2" />
        {/* denim jacket, shirt and neck */}
        <path d="M2 64 C4 55 12 51 22 49 L42 49 C52 51 60 55 62 64 Z" fill="#4c6f9c" />
        <path d="M22 49 L32 60 L42 49 C40 48 36 47.5 32 47.5 C28 47.5 24 48 22 49 Z" fill="#dfe3e8" />
        <path d="M22 49 L28 64 L20 64 L15 52 Z M42 49 L36 64 L44 64 L49 52 Z" fill="#3b5a84" />
        <path d="M27 43 L37 43 L37 50 C35 52 29 52 27 50 Z" fill="#d6a37e" />
        <g transform="translate(32 34) scale(1.1) translate(-32 -34)">
        {/* ears and face */}
        <ellipse cx="19.6" cy="32.5" rx="2.4" ry="3.6" fill="#d6a37e" />
        <ellipse cx="44.4" cy="32.5" rx="2.4" ry="3.6" fill="#d6a37e" />
        <path d="M20 29 C20 19 25 15 32 15 C39 15 44 19 44 29 L44 35 C44 43 38.5 48 32 48 C25.5 48 20 43 20 35 Z" fill="#e4b791" />
        {/* short beard and moustache */}
        <path d="M20.2 33 C20.6 42 25.5 48.2 32 48.2 C38.5 48.2 43.4 42 43.8 33 C42.6 37.6 39.6 40.4 36 41 C34.6 39.8 29.4 39.8 28 41 C24.4 40.4 21.4 37.6 20.2 33 Z" fill="#2a221d" opacity="0.62" />
        <path d="M27.6 39.3 C29.6 38 34.4 38 36.4 39.3 C34.8 40 29.2 40 27.6 39.3 Z" fill="#2a221d" opacity="0.8" />
        <path d="M29.6 42.4 Q32 43.6 34.4 42.4" stroke="#5e3a2e" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {/* hair: short sides, swept-up top */}
        <path d="M19.4 30 C17.6 18 22 9.2 32 8.4 C39.4 7.8 45.4 11.4 45.8 19 C46 22.8 45.4 26.6 44.6 30 C44 25.4 42.6 22.6 40 21.2 C35.6 22.8 27.6 22.6 23.6 21.4 C21.4 23.4 20.2 26.2 19.4 30 Z" fill="#231c18" />
        <path d="M23.4 15.6 C26.6 10.6 34.4 8.6 41 11 C37.6 11.4 33.6 12.8 31 15.4 C28.4 14.6 25.8 14.8 23.4 15.6 Z M30 17.4 C33.4 13.8 38.6 12.8 43.2 14.6 C39.6 15 36.4 16.2 34.4 18.2 Z" fill="#3a2f28" />
        {/* brows, eyes, nose */}
        <path d="M24.4 26.4 Q27 25.2 29.6 26.2 M34.4 26.2 Q37 25.2 39.6 26.4" stroke="#231c18" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx="27" cy="30.6" r="1.25" fill="#1d1714" />
        <circle cx="37" cy="30.6" r="1.25" fill="#1d1714" />
        <path d="M32.2 31 Q31 35.4 33.4 35.8" stroke="#b9845f" strokeWidth="1" fill="none" strokeLinecap="round" />
        {/* dark rectangular glasses */}
        <rect x="22.4" y="27.4" width="9" height="6.6" rx="1.8" fill="#ffffff" fillOpacity="0.18" stroke="#121212" strokeWidth="1.7" />
        <rect x="32.6" y="27.4" width="9" height="6.6" rx="1.8" fill="#ffffff" fillOpacity="0.18" stroke="#121212" strokeWidth="1.7" />
        <path d="M31.4 29.6 L32.6 29.6 M22.4 29 L19.8 28.2 M41.6 29 L44.2 28.2" stroke="#121212" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
