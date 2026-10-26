import type { useTrainingSession } from "@/hooks/useTrainingSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GRADE_LABEL, gradeBadgeClass } from "@/lib/presentation";

type Props = Pick<
  ReturnType<typeof useTrainingSession>,
  "feedback" | "selfAssess"
>;
export function AnswerFeedback({ feedback, selfAssess }: Props) {
  return (
    <>
      {feedback.visible ? (
        <div className="rounded-[1.35rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,240,231,0.92))] p-5 shadow-[0_18px_52px_rgba(64,38,19,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge className={cn("border", gradeBadgeClass(feedback.grade))}>
              {GRADE_LABEL[feedback.grade]}
            </Badge>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {feedback.patternLine} · {feedback.source}
            </span>
          </div>

          <div className="mt-5 grid gap-5">
            {/* Correct answer is always useful; label adapts to the grade. */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {feedback.grade === "correct"
                  ? "Natural English"
                  : "Correct answer"}
              </div>
              <p className="mt-2 text-base leading-7">
                {feedback.correctAnswer}
              </p>
            </div>

            {/* Rich explanatory stack only when it helps: on a miss. */}
            {feedback.grade === "wrong" ? (
              <>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Why the literal version sounds off
                  </div>
                  <p className="mt-2 text-base leading-7 text-muted-foreground">
                    {feedback.whyUnnatural}
                  </p>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Native speaker thinking
                  </div>
                  <p className="mt-2 text-base leading-7">
                    {feedback.nativeThinking}
                  </p>
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
              </>
            ) : null}

            {/* "Almost" gets a focused nudge, not the full stack. */}
            {feedback.grade === "almost" ? (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Common learner mistake
                </div>
                <p className="mt-2 text-base leading-7">
                  {feedback.commonMistake}
                </p>
              </div>
            ) : null}

            {/* Offline / revealed: let the learner grade themselves honestly. */}
            {feedback.needsSelfAssess ? (
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="text-sm font-medium">Did you get it right?</div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    className="rounded-full px-5"
                    onClick={() => selfAssess(true)}
                  >
                    I got it
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full px-5"
                    onClick={() => selfAssess(false)}
                  >
                    I missed it
                  </Button>
                </div>
              </div>
            ) : null}

            {feedback.error ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                Offline note: {feedback.error}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-[1.35rem] border border-dashed border-border/80 bg-muted/35 p-5 text-sm leading-6 text-muted-foreground">
          Answer an exercise to see the full feedback stack: correct answer,
          mental model, native speaker thinking, and common mistakes.
        </div>
      )}
    </>
  );
}
