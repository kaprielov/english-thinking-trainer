import type { ExerciseType, Pattern, PatternStatus } from "@/data/patterns";
import { isAnswerCorrect, normalizeAnswer } from "@/lib/grading.mjs";
import {
  createSrsState,
  nextPatternId,
  pickDueForReview,
  rankByPriority,
  type SrsState,
} from "@/lib/srs.mjs";
import type { Stats } from "@/lib/stats.mjs";

// Re-exported for backwards compatibility; these now live in the grader.
export { isAnswerCorrect, normalizeAnswer };

export interface PatternProgress {
  status: PatternStatus;
  correctCount: number;
  mistakeCount: number;
}

export interface SessionState {
  activePatternIndex: number;
  exerciseIndex: number;
  sessionCount: number;
  progress: Record<string, PatternProgress>;
  /** Time-based spaced-repetition state, keyed by pattern id. */
  srs: Record<string, SrsState>;
  /** Daily streak and goal tracking. */
  stats: Stats;
  currentExercise: Exercise;
}

export interface Exercise {
  id: string;
  type: ExerciseType;
  patternId: string;
  patternTitle: string;
  prompt: string;
  acceptedAnswers: string[];
  /** Closed-set options (which-native only). */
  choices?: string[];
  /** Optional Russian crutch, shown only at low scaffold steps for EN-stimulus exercises. */
  l1Hint?: string;
}

// Exercise sequence per scaffold step. Lower steps lean on the RU-stimulus
// `translation`; higher steps are meaning-first (`situation`) and drop the L1.
const SCAFFOLD_TYPES: Record<number, ExerciseType[]> = {
  0: ["translation", "translation", "cloze", "unnatural", "situation"],
  1: ["translation", "cloze", "situation", "unnatural", "situation"],
  2: ["cloze", "situation", "which-native", "situation", "unnatural"],
  3: ["situation", "situation", "which-native", "cloze", "situation"],
  4: ["situation", "which-native", "situation", "unnatural", "situation"],
};
const REVIEW_QUEUE_SIZE = 4;

export function scaffoldTypeForStep(step: number, exerciseIndex: number): ExerciseType {
  const sequence = SCAFFOLD_TYPES[step] ?? SCAFFOLD_TYPES[4];
  return sequence[exerciseIndex % sequence.length];
}

export function showL1Hint(step: number) {
  return step <= 1;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function createInitialProgress(patterns: Pattern[]): Record<string, PatternProgress> {
  return Object.fromEntries(
    patterns.map((pattern) => [
      pattern.id,
      {
        status: "learning" as const,
        correctCount: 0,
        mistakeCount: 0,
      },
    ]),
  );
}

export function createInitialSrs(patterns: Pattern[], now: number): Record<string, SrsState> {
  return Object.fromEntries(patterns.map((pattern) => [pattern.id, createSrsState(now)]));
}

export function deriveStatus(progress: PatternProgress): PatternStatus {
  if (progress.correctCount >= 4 && progress.mistakeCount === 0) {
    return "mastered";
  }

  if (progress.mistakeCount > 0 && progress.mistakeCount >= progress.correctCount) {
    return "needs-review";
  }

  if (progress.correctCount >= 2) {
    return "practicing";
  }

  return "learning";
}

/** Patterns ordered for the mixed-review panel: most overdue and new first. */
export function reviewQueue(patterns: Pattern[], srs: Record<string, SrsState>, now: number) {
  const byId = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  return rankByPriority(
    patterns.map((pattern) => pattern.id),
    srs,
    now,
  )
    .map((id) => byId.get(id))
    .filter((pattern): pattern is Pattern => Boolean(pattern))
    .slice(0, REVIEW_QUEUE_SIZE);
}

/** Index of the pattern to fold into the in-session mixed-review slot, or -1. */
export function reviewPatternIndex(
  patterns: Pattern[],
  srs: Record<string, SrsState>,
  now: number,
  excludeId: string,
) {
  const id = pickDueForReview(
    patterns.map((pattern) => pattern.id),
    srs,
    now,
    excludeId,
  );
  return id ? patterns.findIndex((pattern) => pattern.id === id) : -1;
}

// "Which sounds native?" contrasts the correct English with the literal calque.
function makeWhichNativeChoices(pattern: Pattern) {
  const literal = pattern.commonMistakes[0] ?? pattern.literalThinking;
  return shuffle([pattern.correctEnglish, literal]);
}

export function buildExercise(
  sourcePattern: Pattern,
  type: ExerciseType,
  exerciseIndex: number,
  withL1Hint = false,
): Exercise {
  if (type === "which-native") {
    return {
      id: `${sourcePattern.id}-which-native-${exerciseIndex}`,
      type,
      patternId: sourcePattern.id,
      patternTitle: sourcePattern.title,
      prompt: "Which one sounds like a native speaker?",
      acceptedAnswers: [sourcePattern.correctEnglish],
      choices: makeWhichNativeChoices(sourcePattern),
    };
  }

  // `type` is now a production type, all of which carry `{ prompt, answers }`.
  const template = sourcePattern.prompts[type];
  return {
    id: `${sourcePattern.id}-${type}-${exerciseIndex}`,
    type,
    patternId: sourcePattern.id,
    patternTitle: sourcePattern.title,
    prompt: template.prompt,
    acceptedAnswers: [...template.answers],
    // Keep the RU stimulus as an optional reveal on EN-first exercises early on.
    l1Hint: withL1Hint && type !== "translation" ? sourcePattern.prompts.translation.prompt : undefined,
  };
}

/** Build the exercise appropriate to a pattern's current scaffold step. */
export function buildExerciseForStep(
  sourcePattern: Pattern,
  step: number,
  exerciseIndex: number,
): Exercise {
  return buildExercise(sourcePattern, scaffoldTypeForStep(step, exerciseIndex), exerciseIndex, showL1Hint(step));
}

/** Index of the pattern to study next, chosen by the spaced-repetition scheduler. */
export function nextActivePatternIndex(patterns: Pattern[], srs: Record<string, SrsState>, now: number) {
  const id = nextPatternId(
    patterns.map((pattern) => pattern.id),
    srs,
    now,
  );
  const index = patterns.findIndex((pattern) => pattern.id === id);
  return index >= 0 ? index : 0;
}
