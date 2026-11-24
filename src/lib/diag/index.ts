// The diagnostics in the professor's exam format. (The Unit 2 diagnostic is paper 7 in paper.ts, which
// already builds Exam 3's exact layout.)
import type { DPaper } from "./kit.ts";
import { DIAG_U1 } from "./u1.ts";
import { DIAG_U3 } from "./u3.ts";
import { DIAG_FINAL } from "./final.ts";

const ALL: DPaper[] = [
  DIAG_U1,
  DIAG_U3,
  DIAG_FINAL,
];
export const DIAG_IDS = { u1: "dx:u1", u3: "dx:u3", final: "dx:final" } as const;
export const diagById = (id: string) => ALL.find((p) => p.id === id) ?? null;
export const allDiags = () => ALL;
