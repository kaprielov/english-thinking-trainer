import { useEffect, useMemo, useState } from "react";
import { patterns, type PatternStatus } from "@/data/patterns";
import {
  buildExerciseForStep,
  createInitialProgress,
  createInitialSrs,
  deriveStatus,
  nextActivePatternIndex,
  reviewPatternIndex,
  reviewQueue,
  type Exercise,
  type PatternProgress,
  type SessionState,
} from "@/lib/session";
import {
  combineWithLLM,
  localGrade,
  offlineGrade,
  type Grade,
} from "@/lib/grading.mjs";
import { dueCount, isNew, scaffoldStep, scheduleNext } from "@/lib/srs.mjs";
import { createStats, goalMet, registerActivity } from "@/lib/stats.mjs";

// v2 introduces time-based SRS state; the shape changed, so use a new key and
// let any v1 state fall through to a fresh start.
const STORAGE_KEY = "english-thinking-trainer:v2";
export const SESSION_LENGTH = 5;

function freshState(): SessionState {
  const now = Date.now();
  const srs = createInitialSrs(patterns, now);
  return {
    activePatternIndex: 0,
    exerciseIndex: 0,
    sessionCount: 1,
    progress: createInitialProgress(patterns),
    srs,
    stats: createStats(),
    currentExercise: buildExerciseForStep(
      patterns[0],
      scaffoldStep(srs[patterns[0].id]),
      0,
    ),
  };
}

function loadState(): SessionState {
  const fallback = freshState();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<SessionState>;
    if (!parsed.progress || !parsed.srs) return fallback;

    return {
      activePatternIndex:
        typeof parsed.activePatternIndex === "number"
          ? parsed.activePatternIndex
          : 0,
      exerciseIndex:
        typeof parsed.exerciseIndex === "number" ? parsed.exerciseIndex : 0,
      sessionCount:
        typeof parsed.sessionCount === "number" ? parsed.sessionCount : 1,
      progress: parsed.progress as SessionState["progress"],
      srs: parsed.srs as SessionState["srs"],
      stats:
        (parsed.stats as SessionState["stats"] | undefined) ?? createStats(),
      currentExercise:
        (parsed.currentExercise as Exercise | undefined) ??
        buildExerciseForStep(patterns[0], 0, 0),
    };
  } catch {
    return fallback;
  }
}

function saveState(state: SessionState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getPatternIndex(id: string) {
  return patterns.findIndex((pattern) => pattern.id === id);
}

function progressAfterGrade(
  progress: PatternProgress,
  grade: Grade,
): PatternProgress {
  let { correctCount, mistakeCount } = progress;

  if (grade === "correct") {
    correctCount += 1;
  } else if (grade === "wrong") {
    mistakeCount += 1;
  }
  // "almost" nudges the schedule (handled by SRS) but doesn't move the coarse
  // familiarity counts; "ungraded" leaves everything untouched (self-assess).

  const next: PatternProgress = {
    correctCount,
    mistakeCount,
    status: progress.status,
  };
  next.status = deriveStatus(next);
  return next;
}

export function useTrainingSession() {
  const [state, setState] = useState<SessionState>(() => loadState());
  const [answer, setAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    grade: Grade;
    needsSelfAssess: boolean;
    correctAnswer: string;
    whyUnnatural: string;
    nativeThinking: string;
    patternLine: string;
    examples: string[];
    commonMistake: string;
    source: string;
    error?: string;
  }>({
    visible: false,
    grade: "correct",
    needsSelfAssess: false,
    correctAnswer: "",
    whyUnnatural: "",
    nativeThinking: "",
    patternLine: "",
    examples: [],
    commonMistake: "",
    source: "local",
  });
  const [stepComplete, setStepComplete] = useState(false);
  const [sessionTally, setSessionTally] = useState({
    correct: 0,
    almost: 0,
    wrong: 0,
  });

  const activePattern = patterns[state.activePatternIndex] ?? patterns[0];
  const activeProgress = state.progress[activePattern.id];
  const queue = useMemo(
    () => reviewQueue(patterns, state.srs, Date.now()),
    [state.srs],
  );
  const dueNow = useMemo(() => dueCount(state.srs, Date.now()), [state.srs]);
  const counts = useMemo(() => {
    return Object.values(state.progress).reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { learning: 0, practicing: 0, "needs-review": 0, mastered: 0 } as Record<
        PatternStatus,
        number
      >,
    );
  }, [state.progress]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  function nextExercisePattern() {
    setStepComplete(false);
    setFeedback((current) => ({ ...current, visible: false }));
    setAnswer("");
    setSelectedChoice(null);
    // A new pattern begins the next session — start its accuracy tally fresh.
    if (state.exerciseIndex + 1 >= SESSION_LENGTH) {
      setSessionTally({ correct: 0, almost: 0, wrong: 0 });
    }

    setState((current) => {
      const now = Date.now();

      if (current.exerciseIndex + 1 < SESSION_LENGTH) {
        const nextIndex = current.exerciseIndex + 1;
        // The penultimate slot folds in the most overdue *other* pattern.
        const reviewIndex =
          nextIndex === SESSION_LENGTH - 1
            ? reviewPatternIndex(patterns, current.srs, now, activePattern.id)
            : -1;
        const shouldMix = reviewIndex >= 0;
        const candidate = shouldMix ? patterns[reviewIndex] : activePattern;

        return {
          ...current,
          exerciseIndex: nextIndex,
          // Each pattern is drilled at its own scaffold step.
          currentExercise: buildExerciseForStep(
            candidate,
            scaffoldStep(current.srs[candidate.id]),
            nextIndex,
          ),
        };
      }

      // Session finished: let the scheduler pick what to study next (due reviews
      // first, a new pattern only when the learning gate allows).
      const nextIndex = nextActivePatternIndex(patterns, current.srs, now);
      const nextPattern = patterns[nextIndex] ?? patterns[0];
      return {
        ...current,
        activePatternIndex: nextIndex,
        exerciseIndex: 0,
        sessionCount: current.sessionCount + 1,
        currentExercise: buildExerciseForStep(
          nextPattern,
          scaffoldStep(current.srs[nextPattern.id]),
          0,
        ),
      };
    });
  }

  function applyGrade(patternId: string, grade: Grade) {
    const now = Date.now();
    setState((current) => ({
      ...current,
      progress: {
        ...current.progress,
        [patternId]: progressAfterGrade(current.progress[patternId], grade),
      },
      srs: {
        ...current.srs,
        [patternId]: scheduleNext(current.srs[patternId], grade, now),
      },
      stats: registerActivity(current.stats, now),
    }));
    setSessionTally((tally) => ({
      correct: tally.correct + (grade === "correct" ? 1 : 0),
      almost: tally.almost + (grade === "almost" ? 1 : 0),
      wrong: tally.wrong + (grade === "wrong" ? 1 : 0),
    }));
  }

  async function evaluateCurrentAnswer(submitted: string) {
    if (stepComplete || isEvaluating) return;
    const exercise = state.currentExercise;
    const sourcePattern =
      patterns[getPatternIndex(exercise.patternId)] ?? activePattern;

    const local = localGrade({
      exerciseType: exercise.type,
      answer: submitted,
      acceptedAnswers: exercise.acceptedAnswers,
      matchers: sourcePattern.matchers,
    });

    // Fast path: exact match / closed-set recognition are decided offline with
    // no network round-trip and no LLM cost.
    if (local.decided && local.grade) {
      applyGrade(sourcePattern.id, local.grade);
      showPatternFeedback(sourcePattern, local.grade, {
        source: "local",
        needsSelfAssess: false,
      });
      setStepComplete(true);
      return;
    }

    if (import.meta.env.VITE_ENABLE_AI !== "true") {
      showPatternFeedback(sourcePattern, offlineGrade(local), {
        source: "reference",
        needsSelfAssess: true,
      });
      setStepComplete(true);
      return;
    }

    setIsEvaluating(true);

    try {
      const response = await fetch("/api/check-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: submitted,
          exercise: { type: exercise.type, prompt: exercise.prompt },
          pattern: sourcePattern,
        }),
      });

      if (!response.ok) {
        throw new Error(`Check request failed with ${response.status}`);
      }

      const result = (await response.json()) as {
        source?: string;
        rubric?: {
          usesPattern: boolean;
          grammatical: boolean;
          natural: boolean;
        } | null;
        correctedAnswer?: string;
        reasonWhyUnnatural?: string;
        nativeSpeakerThinking?: string;
        patternSummary?: string;
        moreExamples?: string[];
        commonMistake?: string;
        error?: string;
      };

      const grade = combineWithLLM(local, result.rubric);
      const needsSelfAssess = grade === "ungraded";
      if (!needsSelfAssess) {
        applyGrade(sourcePattern.id, grade);
      }

      setFeedback({
        visible: true,
        grade,
        needsSelfAssess,
        correctAnswer:
          result.correctedAnswer ||
          state.currentExercise.acceptedAnswers[0] ||
          sourcePattern.correctEnglish,
        whyUnnatural: result.reasonWhyUnnatural || sourcePattern.description,
        nativeThinking:
          result.nativeSpeakerThinking || sourcePattern.nativeThinking,
        patternLine: result.patternSummary || sourcePattern.title,
        examples: (result.moreExamples && result.moreExamples.length > 0
          ? result.moreExamples
          : sourcePattern.examples
        ).slice(0, 4),
        commonMistake:
          result.commonMistake ||
          sourcePattern.commonMistakes[0] ||
          "Literal translation from the native language.",
        source: result.source || "llmgateway",
        error: result.error,
      });

      setStepComplete(true);
    } catch (error) {
      // Offline / API error: never counts as a mistake. Fall back to the local
      // grade (usually "ungraded") and ask the learner to self-assess.
      const grade = offlineGrade(local);
      showPatternFeedback(sourcePattern, grade, {
        source: "offline",
        needsSelfAssess: grade === "ungraded",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      if (grade !== "ungraded") {
        applyGrade(sourcePattern.id, grade);
      }
      setStepComplete(true);
    } finally {
      setIsEvaluating(false);
    }
  }

  function showPatternFeedback(
    sourcePattern: (typeof patterns)[number],
    grade: Grade,
    opts: { source: string; needsSelfAssess: boolean; error?: string },
  ) {
    setFeedback({
      visible: true,
      grade,
      needsSelfAssess: opts.needsSelfAssess,
      correctAnswer:
        state.currentExercise.acceptedAnswers[0] ??
        sourcePattern.correctEnglish,
      whyUnnatural: sourcePattern.description,
      nativeThinking: sourcePattern.nativeThinking,
      patternLine: sourcePattern.title,
      examples: sourcePattern.examples.slice(0, 4),
      commonMistake:
        sourcePattern.commonMistakes[0] ||
        "Literal translation from the native language.",
      source: opts.source,
      error: opts.error,
    });
  }

  function selfAssess(matched: boolean) {
    const exercise = state.currentExercise;
    const sourcePattern =
      patterns[getPatternIndex(exercise.patternId)] ?? activePattern;
    const grade: Grade = matched ? "correct" : "wrong";
    applyGrade(sourcePattern.id, grade);
    setFeedback((current) => ({
      ...current,
      grade,
      needsSelfAssess: false,
      source: "self-assess",
    }));
  }

  function revealAnswer() {
    const exercise = state.currentExercise;
    const sourcePattern =
      patterns[getPatternIndex(exercise.patternId)] ?? activePattern;

    // Revealing the answer doesn't score anything on its own; the learner
    // self-assesses whether they actually knew it.
    setFeedback({
      visible: true,
      grade: "ungraded",
      needsSelfAssess: true,
      correctAnswer:
        state.currentExercise.acceptedAnswers[0] ??
        sourcePattern.correctEnglish,
      whyUnnatural: sourcePattern.description,
      nativeThinking: sourcePattern.nativeThinking,
      patternLine: sourcePattern.title,
      examples: sourcePattern.examples.slice(0, 4),
      commonMistake:
        sourcePattern.commonMistakes[0] ??
        "Literal translation from the native language.",
      source: "reference",
    });

    setStepComplete(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.currentExercise.type === "which-native") {
      void evaluateCurrentAnswer(selectedChoice ?? "");
      return;
    }

    void evaluateCurrentAnswer(answer);
  }

  function handleReset() {
    setSessionTally({ correct: 0, almost: 0, wrong: 0 });
    setState(freshState());
    setAnswer("");
    setSelectedChoice(null);
    setFeedback((current) => ({ ...current, visible: false }));
    setStepComplete(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  const isNewPattern = isNew(state.srs[activePattern.id]);
  const sessionLabel = isNewPattern
    ? "New pattern"
    : dueNow > 0
      ? `${dueNow} due for review`
      : "Review cycle";

  const sessionAnswered =
    sessionTally.correct + sessionTally.almost + sessionTally.wrong;
  const sessionAccuracy = sessionAnswered
    ? Math.round((sessionTally.correct / sessionAnswered) * 100)
    : 0;
  const goalProgress = Math.min(
    100,
    Math.round((state.stats.todayCount / state.stats.dailyGoal) * 100),
  );
  const goalReached = goalMet(state.stats, Date.now());

  return {
    state,
    answer,
    setAnswer,
    selectedChoice,
    setSelectedChoice,
    isEvaluating,
    feedback,
    stepComplete,
    sessionTally,
    activePattern,
    activeProgress,
    queue,
    dueNow,
    counts,
    nextExercisePattern,
    selfAssess,
    revealAnswer,
    handleSubmit,
    handleReset,
    sessionLabel,
    sessionAnswered,
    sessionAccuracy,
    goalProgress,
    goalReached,
  };
}
