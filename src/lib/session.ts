import type { ExerciseType, Pattern, PatternStatus } from "@/data/patterns";

export interface PatternProgress {
  status: PatternStatus;
  correctCount: number;
  mistakeCount: number;
  reviewScore: number;
}

export interface SessionState {
  activePatternIndex: number;
  exerciseIndex: number;
  sessionCount: number;
  progress: Record<string, PatternProgress>;
  currentExercise: Exercise;
}

export interface Exercise {
  id: string;
  type: ExerciseType;
  patternId: string;
  patternTitle: string;
  prompt: string;
  acceptedAnswers: string[];
  choices?: string[];
}

const SESSION_ORDER: ExerciseType[] = ["translation", "unnatural", "situation", "recognition"];
const REVIEW_POOL_SIZE = 3;

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function normalizeAnswer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[.,!?;:()[\]{}]/g, "")
    .replace(/\s+/g, " ");
}

export function isAnswerCorrect(answer: string, acceptedAnswers: string[]) {
  const normalized = normalizeAnswer(answer);
  return acceptedAnswers.some((candidate) => normalizeAnswer(candidate) === normalized);
}

export function createInitialProgress(patterns: Pattern[]) {
  return Object.fromEntries(
    patterns.map((pattern, index) => [
      pattern.id,
      {
        status: index === 0 ? ("learning" as const) : ("learning" as const),
        correctCount: 0,
        mistakeCount: 0,
        reviewScore: 0,
      },
    ]),
  );
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

export function chooseReviewPattern(patterns: Pattern[], progress: Record<string, PatternProgress>) {
  const sorted = [...patterns]
    .filter((pattern) => progress[pattern.id])
    .sort((a, b) => progress[b.id].reviewScore - progress[a.id].reviewScore);

  return sorted.slice(0, REVIEW_POOL_SIZE);
}

function makeRecognitionChoices(pattern: Pattern, patterns: Pattern[]) {
  const distractors = shuffle(patterns.filter((candidate) => candidate.id !== pattern.id))
    .slice(0, 2)
    .map((candidate) => candidate.title);

  return shuffle([pattern.prompts.recognition.answer, ...distractors]);
}

export function buildExercise(
  patterns: Pattern[],
  sourcePattern: Pattern,
  exerciseIndex: number,
  isMixedReview = false,
): Exercise {
  const type = isMixedReview
    ? (shuffle(SESSION_ORDER)[0] ?? "translation")
    : SESSION_ORDER[exerciseIndex % SESSION_ORDER.length];

  const template = sourcePattern.prompts[type];
  const acceptedAnswers =
    type === "recognition"
      ? [sourcePattern.prompts.recognition.answer]
      : [...template.answers, sourcePattern.correctEnglish];

  return {
    id: `${sourcePattern.id}-${type}-${exerciseIndex}`,
    type,
    patternId: sourcePattern.id,
    patternTitle: sourcePattern.title,
    prompt: template.prompt,
    acceptedAnswers,
    choices: type === "recognition" ? makeRecognitionChoices(sourcePattern, patterns) : undefined,
  };
}

export function nextActivePattern(patterns: Pattern[], progress: Record<string, PatternProgress>, currentIndex: number) {
  const nextIndex = patterns.findIndex((pattern, index) => index > currentIndex && progress[pattern.id].status !== "mastered");

  if (nextIndex >= 0) {
    return nextIndex;
  }

  return patterns.findIndex((pattern) => progress[pattern.id].status !== "mastered") >= 0
    ? patterns.findIndex((pattern) => progress[pattern.id].status !== "mastered")
    : currentIndex;
}
