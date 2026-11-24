// Every lesson, in course order. Each lesson file is written against kit.ts and checked by lessons.test.ts.
import type { Lesson, UnitId } from "./types.ts";
import { RED_DEFS } from "./red.ts";
import { LESSON_01 } from "./l01.ts";
import { LESSON_02 } from "./l02.ts";
import { LESSON_03 } from "./l03.ts";
import { LESSON_04 } from "./l04.ts";
import { LESSON_06 } from "./l06.ts";
import { LESSON_07 } from "./l07.ts";
import { LESSON_08 } from "./l08.ts";
import { LESSON_09 } from "./l09.ts";
import { LESSON_10 } from "./l10.ts";
import { LESSON_11 } from "./l11.ts";
import { LESSON_12 } from "./l12.ts";
import { LESSON_13 } from "./l13.ts";
import { LESSON_14 } from "./l14.ts";
import { LESSON_15 } from "./l15.ts";
import { LESSON_16 } from "./l16.ts";
import { LESSON_17 } from "./l17.ts";
import { LESSON_18 } from "./l18.ts";
import { LESSON_19 } from "./l19.ts";
import { LESSON_20 } from "./l20.ts";
import { LESSON_21 } from "./l21.ts";

const ALL: Lesson[] = [LESSON_01, LESSON_02, LESSON_03, LESSON_04, LESSON_06, LESSON_07, LESSON_08, LESSON_09, LESSON_10, LESSON_11, LESSON_12, LESSON_13, LESSON_14, LESSON_15, LESSON_16, LESSON_17, LESSON_18, LESSON_19, LESSON_20, LESSON_21].sort((a, b) => a.n - b.n);

/** Lessons with his red-highlighted definitions tagged (see red.ts). */
export const LESSONS: Lesson[] = ALL.map((L) => ({ ...L, defs: L.defs.map((d) => ({ ...d, red: RED_DEFS.has(`${L.n}|${d.term}`) })) }));

export const lessonByN = (n: number) => LESSONS.find((l) => l.n === n) ?? null;
export const lessonsInUnit = (u: UnitId) => LESSONS.filter((l) => l.unit === u);
