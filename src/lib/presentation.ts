import type { ExerciseType, PatternStatus } from "@/data/patterns";
import type { Grade } from "@/lib/grading.mjs";
import { isNew, isDue, type SrsState } from "@/lib/srs.mjs";

export function statusLabel(status: PatternStatus) {
  switch (status) {
    case "learning":
      return "Learning";
    case "practicing":
      return "Practicing";
    case "needs-review":
      return "Needs review";
    case "mastered":
      return "Mastered";
  }
}

export function statusClass(status: PatternStatus) {
  switch (status) {
    case "learning":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "practicing":
      return "bg-slate-100 text-slate-900 border-slate-200";
    case "needs-review":
      return "bg-rose-100 text-rose-900 border-rose-200";
    case "mastered":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
  }
}

export function dueLabel(state: SrsState | undefined, now: number) {
  if (isNew(state)) return "New";
  if (!state || isDue(state, now)) return "Due now";
  const days = Math.round((state.dueAt - now) / (24 * 60 * 60 * 1000));
  if (days >= 1) return `in ${days}d`;
  const hours = Math.max(1, Math.round((state.dueAt - now) / (60 * 60 * 1000)));
  return `in ${hours}h`;
}

export function gradeBadgeClass(grade: Grade) {
  switch (grade) {
    case "correct":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "almost":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "wrong":
      return "bg-rose-100 text-rose-900 border-rose-200";
    case "ungraded":
      return "bg-slate-100 text-slate-900 border-slate-200";
  }
}

export const EXERCISE_LABELS: Record<ExerciseType, string> = {
  translation: "Translate from Russian",
  unnatural: "Fix the unnatural English",
  situation: "Respond to the situation",
  cloze: "Fill the gap",
  "which-native": "Which sounds native?",
};

export const GRADE_LABEL: Record<Grade, string> = {
  correct: "Correct",
  almost: "Almost — right idea, small slip",
  wrong: "Not quite",
  ungraded: "Not graded (offline)",
};
