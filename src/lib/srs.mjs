// Spaced-repetition scheduler (SM-2 lite).
//
// Retention is time-based: every reviewed pattern carries a `dueAt` timestamp,
// and sessions are composed from what is due rather than from a linear index.
// Pure functions take `now` (epoch ms) as a parameter so scheduling is
// deterministic and unit-testable.
//
// Vocabulary note: `ease`/`intervalDays` are the SM-2 analogues of FSRS
// "difficulty"/"stability". We start with SM-2 lite and can swap in FSRS later
// behind the same function surface.

/** @typedef {"correct" | "almost" | "wrong" | "ungraded"} Grade */

export const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

// A pattern is "still learning" until it has this many consecutive successes;
// we cap how many such patterns exist before introducing another new one.
const LEARNING_REPS = 2;
const MAX_LEARNING = 3;

export function createSrsState(now) {
  return {
    reps: 0,
    lapses: 0,
    ease: DEFAULT_EASE,
    intervalDays: 0,
    dueAt: now, // new patterns are due immediately
    lastReviewedAt: null,
  };
}

/** Map the grader's verdict to an SM-2 recall quality (0-5), or null to skip scheduling. */
export function gradeToQuality(grade) {
  switch (grade) {
    case "correct":
      return 4;
    case "almost":
      return 3;
    case "wrong":
      return 2;
    default:
      return null; // "ungraded" never reschedules
  }
}

export function scheduleNext(state, grade, now) {
  const quality = gradeToQuality(grade);
  if (quality === null) return state;

  let { reps, lapses, ease, intervalDays } = state;

  if (quality < 3) {
    // Lapse: reset the streak and relearn soon.
    reps = 0;
    lapses += 1;
    intervalDays = 1;
  } else {
    if (reps === 0) intervalDays = 1;
    else if (reps === 1) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(intervalDays * ease));
    reps += 1;
    ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease < MIN_EASE) ease = MIN_EASE;
  }

  return {
    reps,
    lapses,
    ease,
    intervalDays,
    dueAt: now + intervalDays * DAY_MS,
    lastReviewedAt: now,
  };
}

export function isNew(state) {
  return !state || state.lastReviewedAt === null;
}

/**
 * Scaffolding step (0-4) derived from how stable the pattern is. Higher steps
 * strip away the L1 (Russian) crutch and lean on meaning-first production:
 *   0 encounter / heavily scaffolded, 1 scaffolded, 2 cloze/situation,
 *   3 free production, 4 recall.
 */
export function scaffoldStep(state) {
  if (isNew(state)) return 0;
  const reps = state.reps;
  if (reps <= 1) return 1;
  if (reps === 2) return 2;
  if (reps === 3) return 3;
  return 4;
}

export function isDue(state, now) {
  return Boolean(state) && state.dueAt <= now;
}

/** Patterns that have been introduced but haven't stabilized yet. */
export function learningCount(srsMap) {
  return Object.values(srsMap).filter((state) => !isNew(state) && state.reps < LEARNING_REPS).length;
}

export function dueCount(srsMap, now) {
  return Object.values(srsMap).filter((state) => !isNew(state) && isDue(state, now)).length;
}

export function canIntroduceNew(srsMap, { maxLearning = MAX_LEARNING } = {}) {
  return learningCount(srsMap) < maxLearning;
}

/**
 * Order pattern ids for the review queue: most overdue first, then new patterns,
 * then the rest by soonest due.
 */
export function rankByPriority(patternIds, srsMap, now) {
  return [...patternIds].sort((a, b) => priority(srsMap[a], now) - priority(srsMap[b], now));
}

function priority(state, now) {
  if (isNew(state)) return 0; // surface unseen patterns near the top
  // Overdue (dueAt - now < 0) sorts first; far-future due sorts last.
  return 1 + Math.max(0, state.dueAt - now);
}

/**
 * Choose the pattern to study next:
 *   1. the most overdue introduced pattern that is due,
 *   2. otherwise a brand-new pattern if the learning gate allows,
 *   3. otherwise the soonest-due introduced pattern,
 *   4. otherwise any remaining new pattern,
 *   5. otherwise the first pattern.
 */
export function nextPatternId(patternIds, srsMap, now, options = {}) {
  const introduced = patternIds.filter((id) => !isNew(srsMap[id]));
  const dueIntroduced = introduced
    .filter((id) => isDue(srsMap[id], now))
    .sort((a, b) => srsMap[a].dueAt - srsMap[b].dueAt);
  if (dueIntroduced.length > 0) return dueIntroduced[0];

  const firstNew = patternIds.find((id) => isNew(srsMap[id]));
  if (firstNew && canIntroduceNew(srsMap, options)) return firstNew;

  if (introduced.length > 0) {
    return [...introduced].sort((a, b) => srsMap[a].dueAt - srsMap[b].dueAt)[0];
  }

  return firstNew ?? patternIds[0];
}

/**
 * Pick a pattern for the in-session mixed-review slot: the most overdue
 * introduced pattern, excluding the one currently being studied. Falls back to
 * any introduced pattern, else null.
 */
export function pickDueForReview(patternIds, srsMap, now, excludeId) {
  const introduced = patternIds.filter((id) => id !== excludeId && !isNew(srsMap[id]));
  if (introduced.length === 0) return null;
  const due = introduced.filter((id) => isDue(srsMap[id], now));
  const pool = due.length > 0 ? due : introduced;
  return [...pool].sort((a, b) => srsMap[a].dueAt - srsMap[b].dueAt)[0];
}
