import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TrainingOverview } from "@/components/TrainingOverview";
import { ProgressSidebar } from "@/components/ProgressSidebar";
import { AnswerFeedback } from "@/components/AnswerFeedback";
import { useTrainingSession, SESSION_LENGTH } from "@/hooks/useTrainingSession";
import { EXERCISE_LABELS, statusLabel } from "@/lib/presentation";
import { cn } from "@/lib/utils";

function App() {
  const training = useTrainingSession();
  const {
    state,
    answer,
    setAnswer,
    selectedChoice,
    setSelectedChoice,
    isEvaluating,
    feedback,
    stepComplete,
    activePattern,
    activeProgress,
    nextExercisePattern,
    selfAssess,
    revealAnswer,
    handleSubmit,
  } = training;

  return (
    <div className="min-h-screen paper-grid">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <TrainingOverview {...training} />

        <main className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
          <section className="grid content-start gap-6">
            <Card className="overflow-hidden">
              <CardHeader className="gap-4 border-b border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,235,223,0.9))]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground">
                    {statusLabel(activeProgress.status)}
                  </Badge>
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
                    <p className="mt-3 text-base leading-7">
                      {activePattern.nativeThinking}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Literal learner translation
                    </div>
                    <p className="mt-3 text-base leading-7">
                      {activePattern.literalThinking}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900/70">
                      Correct English
                    </div>
                    <p className="mt-3 text-base leading-7 text-emerald-950">
                      {activePattern.correctEnglish}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {activePattern.examples.map((example) => (
                    <div
                      key={example}
                      className="rounded-2xl bg-muted/55 p-4 text-sm leading-6"
                    >
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
                    <CardTitle className="font-serif text-2xl">
                      Exercise
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {EXERCISE_LABELS[state.currentExercise.type]} ·{" "}
                      {state.currentExercise.patternTitle}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="secondary"
                    className="border border-border/60"
                  >
                    {state.exerciseIndex + 1} / {SESSION_LENGTH}
                  </Badge>
                </div>
                <p className="text-base leading-7 text-foreground">
                  {state.currentExercise.prompt}
                </p>
                {state.currentExercise.l1Hint ? (
                  <details className="text-sm text-muted-foreground">
                    <summary className="cursor-pointer select-none font-medium">
                      Show Russian hint
                    </summary>
                    <p className="mt-2 leading-6">
                      {state.currentExercise.l1Hint}
                    </p>
                  </details>
                ) : null}
              </CardHeader>

              <CardContent className="grid gap-4">
                <form className="grid gap-4" onSubmit={handleSubmit}>
                  {state.currentExercise.type === "which-native" ? (
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
                          <span className="block text-sm font-medium">
                            {choice}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Textarea
                      aria-label="Your English answer"
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
                        isEvaluating ||
                        stepComplete ||
                        (state.currentExercise.type === "which-native"
                          ? !selectedChoice
                          : !answer.trim())
                      }
                    >
                      {isEvaluating ? "Checking..." : "Check answer"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-full px-5"
                      disabled={isEvaluating || stepComplete}
                      onClick={revealAnswer}
                    >
                      Show answer
                    </Button>
                  </div>
                </form>

                <AnswerFeedback feedback={feedback} selfAssess={selfAssess} />

                {stepComplete ? (
                  <div className="flex justify-end">
                    <Button
                      onClick={nextExercisePattern}
                      className="rounded-full px-5"
                    >
                      {state.exerciseIndex + 1 < SESSION_LENGTH
                        ? "Next exercise"
                        : "Start next pattern"}
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <ProgressSidebar {...training} />
        </main>
      </div>
    </div>
  );
}

export default App;
