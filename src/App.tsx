import { useEffect, useMemo, useState } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { patterns, type ExerciseType, type Pattern, type PatternStatus } from "@/data/patterns";
import {
  buildExercise,
  chooseReviewPattern,
  createInitialProgress,
  deriveStatus,
  isAnswerCorrect,
  nextActivePattern,
  type Exercise,
  type PatternProgress,
  type SessionState,
} from "@/lib/session";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "english-thinking-trainer:v1";
const SESSION_LENGTH = 5;
const EXERCISE_LABELS: Record<ExerciseType, string> = {
  translation: "Translation",
  unnatural: "Find the unnatural English",
  situation: "Situation",
  recognition: "Pattern recognition",
};

function loadState(): SessionState {
  const fallback = {
    activePatternIndex: 0,
    exerciseIndex: 0,
    sessionCount: 1,
    progress: createInitialProgress(patterns),
    currentExercise: buildExercise(patterns, patterns[0], 0, false),
  } satisfies SessionState;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<SessionState>;
    if (!parsed.progress) return fallback;

    return {
      activePatternIndex: typeof parsed.activePatternIndex === "number" ? parsed.activePatternIndex : 0,
      exerciseIndex: typeof parsed.exerciseIndex === "number" ? parsed.exerciseIndex : 0,
      sessionCount: typeof parsed.sessionCount === "number" ? parsed.sessionCount : 1,
      progress: parsed.progress as Record<string, PatternProgress>,
      currentExercise:
        (parsed.currentExercise as Exercise | undefined) ??
        buildExercise(patterns, patterns[0], 0, false),
    };
  } catch {
    return fallback;
  }
}

function saveState(state: SessionState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function statusLabel(status: PatternStatus) {
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

function statusClass(status: PatternStatus) {
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

function reviewPressure(progress: Record<string, PatternProgress>) {
  return Object.values(progress).reduce((sum, item) => sum + item.reviewScore, 0);
}

function rankQueue(progress: Record<string, PatternProgress>) {
  return [...patterns].sort((a, b) => progress[b.id].reviewScore - progress[a.id].reviewScore);
}

function getPatternIndex(id: string) {
  return patterns.findIndex((pattern) => pattern.id === id);
}

function App() {
  const [state, setState] = useState<SessionState>(() => loadState());
  const [answer, setAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    matched: boolean;
    correctAnswer: string;
    whyUnnatural: string;
    nativeThinking: string;
    patternLine: string;
    examples: string[];
    commonMistake: string;
    label: string;
  }>({
    visible: false,
    matched: true,
    correctAnswer: "",
    whyUnnatural: "",
    nativeThinking: "",
    patternLine: "",
    examples: [],
    commonMistake: "",
    label: "",
  });
  const [stepComplete, setStepComplete] = useState(false);

  const activePattern = patterns[state.activePatternIndex] ?? patterns[0];
  const activeProgress = state.progress[activePattern.id];
  const mixedPool = useMemo(() => chooseReviewPattern(patterns, state.progress), [state.progress]);
  const queue = useMemo(() => rankQueue(state.progress).slice(0, 4), [state.progress]);
  const counts = useMemo(() => {
    return Object.values(state.progress).reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { learning: 0, practicing: 0, "needs-review": 0, mastered: 0 } as Record<PatternStatus, number>,
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

    setState((current) => {
      if (current.exerciseIndex + 1 < SESSION_LENGTH) {
        const nextIndex = current.exerciseIndex + 1;
        const shouldMix = nextIndex === SESSION_LENGTH - 1 && mixedPool.length > 0;
        const candidate = shouldMix
          ? mixedPool.find((pattern) => pattern.id !== activePattern.id) ?? mixedPool[0] ?? activePattern
          : activePattern;

        return {
          ...current,
          exerciseIndex: nextIndex,
          currentExercise: buildExercise(patterns, candidate, nextIndex, shouldMix),
        };
      }

      const nextIndex = nextActivePattern(patterns, current.progress, current.activePatternIndex);
      const nextPattern = patterns[nextIndex] ?? patterns[0];
      const nextState = {
        ...current,
        activePatternIndex: nextIndex,
        exerciseIndex: 0,
        sessionCount: current.sessionCount + 1,
        currentExercise: buildExercise(patterns, nextPattern, 0, false),
      };
      return nextState;
    });
  }

  function evaluateCurrentAnswer(submitted: string, selected?: string | null) {
    const exercise = state.currentExercise;
    const matched =
      exercise.type === "recognition"
        ? selected === exercise.acceptedAnswers[0]
        : isAnswerCorrect(submitted, exercise.acceptedAnswers);

    const sourcePattern = patterns[getPatternIndex(exercise.patternId)] ?? activePattern;
    const progress = state.progress[sourcePattern.id];
    const nextProgress: PatternProgress = {
      correctCount: progress.correctCount + (matched ? 1 : 0),
      mistakeCount: progress.mistakeCount + (matched ? 0 : 1),
      reviewScore: Math.max(0, progress.reviewScore + (matched ? -1 : 2)),
      status: progress.status,
    };

    nextProgress.status = deriveStatus(nextProgress);

    const feedbackCommonMistake = sourcePattern.commonMistakes[0] ?? "Literal translation from the native language.";

    setState((current) => ({
      ...current,
      progress: {
        ...current.progress,
        [sourcePattern.id]: nextProgress,
      },
    }));

    setFeedback({
      visible: true,
      matched,
      correctAnswer:
        exercise.type === "recognition"
          ? sourcePattern.prompts.recognition.answer
          : sourcePattern.correctEnglish,
      whyUnnatural: sourcePattern.description,
      nativeThinking: sourcePattern.nativeThinking,
      patternLine: sourcePattern.title,
      examples: sourcePattern.examples.slice(0, 4),
      commonMistake: feedbackCommonMistake,
      label: matched ? "Pattern matched" : "Literal translation detected",
    });

    setStepComplete(true);
  }

  function revealAnswer() {
    const exercise = state.currentExercise;
    const sourcePattern = patterns[getPatternIndex(exercise.patternId)] ?? activePattern;

    setFeedback({
      visible: true,
      matched: true,
      correctAnswer:
        exercise.type === "recognition"
          ? sourcePattern.prompts.recognition.answer
          : sourcePattern.correctEnglish,
      whyUnnatural: sourcePattern.description,
      nativeThinking: sourcePattern.nativeThinking,
      patternLine: sourcePattern.title,
      examples: sourcePattern.examples.slice(0, 4),
      commonMistake: sourcePattern.commonMistakes[0] ?? "Literal translation from the native language.",
      label: "Reference answer",
    });

    setStepComplete(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.currentExercise.type === "recognition") {
      evaluateCurrentAnswer(selectedChoice ?? "", selectedChoice);
      return;
    }

    evaluateCurrentAnswer(answer);
  }

  function handleReset() {
    const reset = {
      activePatternIndex: 0,
      exerciseIndex: 0,
      sessionCount: 1,
      progress: createInitialProgress(patterns),
      currentExercise: buildExercise(patterns, patterns[0], 0, false),
    };
    setState(reset);
    setAnswer("");
    setSelectedChoice(null);
    setFeedback((current) => ({ ...current, visible: false }));
    setStepComplete(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  const sessionLabel =
    state.sessionCount <= patterns.length
      ? `Pattern ${state.sessionCount} of ${patterns.length}`
      : "Review cycle";

  return (
    <div className="min-h-screen paper-grid">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <header className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit border border-border/60 px-3 py-1 tracking-[0.22em]">
              English Thinking Trainer
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-[10ch] font-serif text-5xl leading-[0.92] tracking-[-0.04em] text-foreground sm:text-6xl lg:text-7xl">
                Train the mental model, not the translation.
              </h1>
              <p className="max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
                One session introduces exactly one new pattern. Exercises then mix translation,
                recognition, and review so the learner internalizes how native English speakers
                actually think.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.35rem] border border-border/70 bg-card/90 p-4 shadow-[0_22px_70px_rgba(64,38,19,0.09)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Current session
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {sessionLabel}
              </span>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Status changes are driven by mistakes and successful recalls. Review pressure rises
              when a pattern slips.
            </p>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-muted/60 p-3">
                <div className="text-muted-foreground">Learning</div>
                <div className="mt-1 font-serif text-2xl">{counts.learning}</div>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3">
                <div className="text-muted-foreground">Mastered</div>
                <div className="mt-1 font-serif text-2xl">{counts.mastered}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
          <section className="grid gap-6">
            <Card className="overflow-hidden">
              <CardHeader className="gap-4 border-b border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,235,223,0.9))]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground">{statusLabel(activeProgress.status)}</Badge>
                  <Badge variant="outline" className="bg-background/70">
                    Core pattern
                  </Badge>
                </div>
                <CardTitle className="font-serif text-3xl leading-tight sm:text-4xl">
                  {activePattern.title}
                </CardTitle>
                <CardDescription className="max-w-3xl text-base leading-7">
                  {activePattern.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 p-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Native thinking
                    </div>
                    <p className="mt-3 text-base leading-7">{activePattern.nativeThinking}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Literal learner translation
                    </div>
                    <p className="mt-3 text-base leading-7">{activePattern.literalThinking}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900/70">
                      Correct English
                    </div>
                    <p className="mt-3 text-base leading-7 text-emerald-950">{activePattern.correctEnglish}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {activePattern.examples.map((example) => (
                    <div key={example} className="rounded-2xl bg-muted/55 p-4 text-sm leading-6">
                      {example}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-serif text-2xl">Exercise</CardTitle>
                    <CardDescription className="mt-1">
                      {EXERCISE_LABELS[state.currentExercise.type]} · {state.currentExercise.patternTitle}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="border border-border/60">
                    {state.exerciseIndex + 1} / {SESSION_LENGTH}
                  </Badge>
                </div>
                <p className="text-base leading-7 text-foreground">{state.currentExercise.prompt}</p>
              </CardHeader>

              <CardContent className="grid gap-4">
                <form className="grid gap-4" onSubmit={handleSubmit}>
                  {state.currentExercise.type === "recognition" ? (
                    <div className="grid gap-3">
                      {state.currentExercise.choices?.map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => setSelectedChoice(choice)}
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                            selectedChoice === choice
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-border bg-background hover:border-primary/40 hover:bg-accent/60",
                          )}
                        >
                          <span className="block text-sm font-medium">{choice}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Textarea
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      placeholder="Type the English sentence here..."
                      className="min-h-32 rounded-[1.1rem] bg-background/95 text-base leading-7"
                    />
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="submit"
                      className="rounded-full px-5"
                      disabled={
                        state.currentExercise.type === "recognition" ? !selectedChoice : !answer.trim()
                      }
                    >
                      Check answer
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-full px-5"
                      onClick={revealAnswer}
                    >
                      Show answer
                    </Button>
                  </div>
                </form>

                {feedback.visible ? (
                  <div className="rounded-[1.35rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,240,231,0.92))] p-5 shadow-[0_18px_52px_rgba(64,38,19,0.08)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Badge className={cn("border", feedback.matched ? "bg-emerald-100 text-emerald-900 border-emerald-200" : "bg-rose-100 text-rose-900 border-rose-200")}>
                        {feedback.label}
                      </Badge>
                      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        {feedback.patternLine}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-5">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Correct answer
                        </div>
                        <p className="mt-2 text-base leading-7">{feedback.correctAnswer}</p>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Why your answer sounds unnatural
                        </div>
                        <p className="mt-2 text-base leading-7 text-muted-foreground">{feedback.whyUnnatural}</p>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Native speaker thinking
                        </div>
                        <p className="mt-2 text-base leading-7">{feedback.nativeThinking}</p>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Pattern
                        </div>
                        <p className="mt-2 text-base leading-7">{feedback.patternLine}</p>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          More examples
                        </div>
                        <ul className="mt-2 grid gap-2 pl-5 text-base leading-7">
                          {feedback.examples.map((example) => (
                            <li key={example} className="list-disc">
                              {example}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Common learner mistake
                        </div>
                        <p className="mt-2 text-base leading-7">{feedback.commonMistake}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.35rem] border border-dashed border-border/80 bg-muted/35 p-5 text-sm leading-6 text-muted-foreground">
                    Answer an exercise to see the full feedback stack: correct answer, mental model,
                    native speaker thinking, and common mistakes.
                  </div>
                )}

                {stepComplete ? (
                  <div className="flex justify-end">
                    <Button onClick={nextExercisePattern} className="rounded-full px-5">
                      {state.exerciseIndex + 1 < SESSION_LENGTH ? "Next exercise" : "Start next pattern"}
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <aside className="grid gap-6">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="font-serif text-2xl">Progress</CardTitle>
                  <Button variant="ghost" size="sm" onClick={handleReset} className="gap-2 rounded-full">
                    <RotateCcw className="size-4" />
                    Reset
                  </Button>
                </div>
                <CardDescription>
                  Review priority rises whenever the learner translates literally or misses the pattern.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["Learning", counts.learning],
                    ["Practicing", counts.practicing],
                    ["Needs review", counts["needs-review"]],
                    ["Mastered", counts.mastered],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-border/70 bg-muted/50 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
                      <div className="mt-2 font-serif text-3xl">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Review pressure</span>
                    <span className="font-serif text-2xl">{reviewPressure(state.progress)}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500 transition-all"
                      style={{ width: `${Math.min(100, reviewPressure(state.progress) * 10)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-2">
                <CardTitle className="font-serif text-2xl">Mixed review</CardTitle>
                <CardDescription>Highest-priority patterns float to the top.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {queue.map((pattern) => {
                  const progress = state.progress[pattern.id];
                  return (
                    <div
                      key={pattern.id}
                      className="rounded-2xl border border-border/70 bg-background/90 p-4 transition-transform duration-200 hover:-translate-y-0.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-serif text-lg">{pattern.title}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{pattern.description}</div>
                        </div>
                        <Badge className={cn("border", statusClass(progress.status))}>{statusLabel(progress.status)}</Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                        <span>Review score</span>
                        <span className="font-medium text-foreground">{progress.reviewScore}</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-2">
                <CardTitle className="font-serif text-2xl">Why this feels different</CardTitle>
                <CardDescription>
                  The app is designed around mental models, not grammar drills or flashcards.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
                <p>
                  The interface makes the native thinking model visible first. Only then does it
                  show the correct English expression, which is the opposite of a translation app.
                </p>
                <p>
                  Each feedback block explains the interference pattern, the native speaker model,
                  the reusable pattern, and fresh examples.
                </p>
              </CardContent>
            </Card>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;
