import type { useTrainingSession } from "@/hooks/useTrainingSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { patterns } from "@/data/patterns";
import { dueLabel, statusClass, statusLabel } from "@/lib/presentation";

type Props = Pick<
  ReturnType<typeof useTrainingSession>,
  | "state"
  | "counts"
  | "dueNow"
  | "queue"
  | "handleReset"
  | "goalReached"
  | "goalProgress"
  | "sessionAnswered"
  | "sessionAccuracy"
  | "sessionTally"
>;
export function ProgressSidebar({
  state,
  counts,
  dueNow,
  queue,
  handleReset,
  goalReached,
  goalProgress,
  sessionAnswered,
  sessionAccuracy,
  sessionTally,
}: Props) {
  return (
    <aside className="grid content-start gap-6">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-serif text-2xl">Today</CardTitle>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              🔥 {state.stats.streak}-day streak
            </span>
          </div>
          <CardDescription>
            Keep the streak alive by clearing a little every day.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Daily goal</span>
              <span className="text-muted-foreground">
                {Math.min(state.stats.todayCount, state.stats.dailyGoal)} /{" "}
                {state.stats.dailyGoal}
                {goalReached ? " ✓" : ""}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  goalReached
                    ? "bg-emerald-500"
                    : "bg-gradient-to-r from-primary to-amber-500",
                )}
                style={{ width: `${goalProgress}%` }}
              />
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">This session</span>
              <span className="font-serif text-2xl">
                {sessionAnswered ? `${sessionAccuracy}%` : "—"}
              </span>
            </div>
            <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
              <span className="text-emerald-700">
                {sessionTally.correct} correct
              </span>
              <span className="text-amber-700">
                {sessionTally.almost} almost
              </span>
              <span className="text-rose-700">{sessionTally.wrong} missed</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-serif text-2xl">Progress</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-2 rounded-full"
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
          </div>
          <CardDescription>
            Review priority rises whenever the learner translates literally or
            misses the pattern.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["Learning", counts.learning],
                ["Practicing", counts.practicing],
                ["Needs review", counts["needs-review"]],
                ["Mastered", counts.mastered],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-border/70 bg-muted/50 p-4"
              >
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {label}
                </div>
                <div className="mt-2 font-serif text-3xl">{value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Due for review now</span>
              <span className="font-serif text-2xl">{dueNow}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500 transition-all"
                style={{
                  width: `${patterns.length ? Math.round((dueNow / patterns.length) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="font-serif text-2xl">Mixed review</CardTitle>
          <CardDescription>
            Highest-priority patterns float to the top.
          </CardDescription>
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
                    <div className="mt-1 text-sm text-muted-foreground">
                      {pattern.description}
                    </div>
                  </div>
                  <Badge className={cn("border", statusClass(progress.status))}>
                    {statusLabel(progress.status)}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Next review</span>
                  <span className="font-medium text-foreground">
                    {dueLabel(state.srs[pattern.id], Date.now())}
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="font-serif text-2xl">
            Why this feels different
          </CardTitle>
          <CardDescription>
            The app is designed around mental models, not grammar drills or
            flashcards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
          <p>
            The interface makes the native thinking model visible first. Only
            then does it show the correct English expression, which is the
            opposite of a translation app.
          </p>
          <p>
            Each feedback block explains the interference pattern, the native
            speaker model, the reusable pattern, and fresh examples.
          </p>
        </CardContent>
      </Card>
    </aside>
  );
}
