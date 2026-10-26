import test from "node:test";
import assert from "node:assert/strict";

import {
  canIntroduceNew,
  createSrsState,
  dueCount,
  gradeToQuality,
  isDue,
  isNew,
  nextPatternId,
  pickDueForReview,
  scheduleNext,
} from "../src/lib/srs.mjs";

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_000_000_000_000; // fixed epoch for determinism

test("a new pattern is due immediately and marked new", () => {
  const state = createSrsState(T0);
  assert.equal(isNew(state), true);
  assert.equal(isDue(state, T0), true);
});

test("gradeToQuality maps grades and skips ungraded", () => {
  assert.equal(gradeToQuality("correct"), 4);
  assert.equal(gradeToQuality("almost"), 3);
  assert.equal(gradeToQuality("wrong"), 2);
  assert.equal(gradeToQuality("ungraded"), null);
});

test("ungraded never reschedules", () => {
  const state = createSrsState(T0);
  assert.deepEqual(scheduleNext(state, "ungraded", T0 + DAY), state);
});

test("successful reviews lengthen the interval; the first two steps are 1 and 6 days", () => {
  let state = createSrsState(T0);
  state = scheduleNext(state, "correct", T0);
  assert.equal(state.reps, 1);
  assert.equal(state.intervalDays, 1);
  assert.equal(state.dueAt, T0 + 1 * DAY);
  assert.equal(isNew(state), false);

  state = scheduleNext(state, "correct", state.dueAt);
  assert.equal(state.reps, 2);
  assert.equal(state.intervalDays, 6);

  const before = state.intervalDays;
  state = scheduleNext(state, "correct", state.dueAt);
  assert.ok(state.intervalDays > before, "third success grows beyond 6 days");
});

test("a wrong answer lapses: streak resets and it comes back tomorrow", () => {
  let state = createSrsState(T0);
  state = scheduleNext(state, "correct", T0);
  state = scheduleNext(state, "correct", state.dueAt); // interval 6, reps 2
  state = scheduleNext(state, "wrong", state.dueAt);
  assert.equal(state.reps, 0);
  assert.equal(state.lapses, 1);
  assert.equal(state.intervalDays, 1);
});

test("'almost' lowers ease relative to 'correct'", () => {
  const base = scheduleNext(createSrsState(T0), "correct", T0); // ease unchanged at 2.5
  const stepCorrect = scheduleNext(base, "correct", base.dueAt);
  const stepAlmost = scheduleNext(base, "almost", base.dueAt);
  assert.ok(stepAlmost.ease < stepCorrect.ease);
});

test("nextPatternId prioritizes due reviews over new patterns", () => {
  const ids = ["a", "b", "c"];
  const srs = {
    a: { ...createSrsState(T0), reps: 3, lastReviewedAt: T0 - 10 * DAY, dueAt: T0 - DAY }, // overdue
    b: createSrsState(T0), // new
    c: createSrsState(T0), // new
  };
  assert.equal(nextPatternId(ids, srs, T0), "a");
});

test("nextPatternId introduces a new pattern when nothing is due and the gate allows", () => {
  const ids = ["a", "b"];
  const srs = {
    a: { ...createSrsState(T0), reps: 3, lastReviewedAt: T0, dueAt: T0 + 6 * DAY }, // not due
    b: createSrsState(T0), // new
  };
  assert.equal(nextPatternId(ids, srs, T0), "b");
});

test("the learning gate blocks new patterns until in-flight ones stabilize", () => {
  // Three introduced-but-not-stabilized patterns (reps < 2) => gate closed.
  const learning = { ...createSrsState(T0), reps: 1, lastReviewedAt: T0, dueAt: T0 + 6 * DAY };
  const srs = { a: { ...learning }, b: { ...learning }, c: { ...learning }, d: createSrsState(T0) };
  assert.equal(canIntroduceNew(srs), false);
  // Nothing due, gate closed => it should fall back to the soonest-due introduced pattern, not new "d".
  assert.notEqual(nextPatternId(["a", "b", "c", "d"], srs, T0), "d");
});

test("dueCount counts only introduced, currently-due patterns", () => {
  const srs = {
    a: { ...createSrsState(T0), reps: 2, lastReviewedAt: T0 - DAY, dueAt: T0 - DAY }, // due
    b: { ...createSrsState(T0), reps: 2, lastReviewedAt: T0, dueAt: T0 + DAY }, // not due
    c: createSrsState(T0), // new — not counted
  };
  assert.equal(dueCount(srs, T0), 1);
});

test("pickDueForReview excludes the active pattern and prefers overdue", () => {
  const srs = {
    active: { ...createSrsState(T0), reps: 2, lastReviewedAt: T0, dueAt: T0 - DAY },
    x: { ...createSrsState(T0), reps: 2, lastReviewedAt: T0, dueAt: T0 - 5 * DAY }, // most overdue
    y: createSrsState(T0), // new — excluded from review pool
  };
  assert.equal(pickDueForReview(["active", "x", "y"], srs, T0, "active"), "x");
});
