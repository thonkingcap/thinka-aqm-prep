// One line at the top of a page: how this page works, with a link to the full walkthrough.
import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { openHowTo } from "./Walkthrough.tsx";

export default function PageHint({ children }: { children: ReactNode }) {
  return (
    <p className="page-hint">
      <CircleHelp size={14} aria-hidden="true" />
      <span><b>How this works:</b> {children}</span>
      <button type="button" className="page-hint-more" onClick={openHowTo}>Walkthrough</button>
    </p>
  );
}
