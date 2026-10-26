import type { useTrainingSession } from "@/hooks/useTrainingSession";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Props = Pick<
  ReturnType<typeof useTrainingSession>,
  "sessionLabel" | "counts"
>;
export function TrainingOverview({ sessionLabel, counts }: Props) {
  return (
    <header className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
      <div className="space-y-4">
        <Badge
          variant="secondary"
          className="w-fit border border-border/60 px-3 py-1 tracking-[0.22em]"
        >
          English Thinking Trainer
        </Badge>
        <p className="text-sm text-muted-foreground">
          {import.meta.env.VITE_ENABLE_AI === "true"
            ? "AI feedback enabled"
            : "Offline practice · AI feedback off"}{" "}
          · Progress stays in this browser.
        </p>
        <div className="space-y-3">
          <h1 className="max-w-[18ch] font-serif text-4xl leading-[1.05] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
            Train the mental model, not the translation.
          </h1>
          <p className="max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            Each pattern starts with a Russian crutch and gradually drops it:
            you move from translation to reacting to English situations
            directly, so you internalize how native English speakers actually
            think.
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
          Status changes are driven by mistakes and successful recalls. Review
          pressure rises when a pattern slips.
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
  );
}
