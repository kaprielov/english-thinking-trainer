import test from "node:test";
import assert from "node:assert/strict";

import { createStats, dayNumber, goalMet, registerActivity } from "../src/lib/stats.mjs";

const NOON = new Date(2026, 0, 15, 12, 0, 0).getTime(); // local noon, avoids DST/day-edge flakiness
const DAY_MS = 24 * 60 * 60 * 1000;

test("first activity starts a streak of 1", () => {
  const stats = registerActivity(createStats(), NOON);
  assert.equal(stats.streak, 1);
  assert.equal(stats.todayCount, 1);
  assert.equal(stats.lastActiveDay, dayNumber(NOON));
});

test("multiple activities on the same day grow the count, not the streak", () => {
  let stats = registerActivity(createStats(), NOON);
  stats = registerActivity(stats, NOON + 60_000);
  stats = registerActivity(stats, NOON + 120_000);
  assert.equal(stats.streak, 1);
  assert.equal(stats.todayCount, 3);
});

test("activity on the next day extends the streak and resets the daily count", () => {
  let stats = registerActivity(createStats(), NOON);
  stats = registerActivity(stats, NOON + DAY_MS);
  assert.equal(stats.streak, 2);
  assert.equal(stats.todayCount, 1);
});

test("a gap of more than one day resets the streak to 1", () => {
  let stats = registerActivity(createStats(), NOON);
  stats = registerActivity(stats, NOON + 3 * DAY_MS);
  assert.equal(stats.streak, 1);
  assert.equal(stats.todayCount, 1);
});

test("goalMet is true only once today's goal is reached", () => {
  let stats = { ...createStats(), dailyGoal: 2 };
  stats = registerActivity(stats, NOON);
  assert.equal(goalMet(stats, NOON), false);
  stats = registerActivity(stats, NOON + 60_000);
  assert.equal(goalMet(stats, NOON), true);
  // yesterday's met goal doesn't count as met today
  assert.equal(goalMet(stats, NOON + DAY_MS), false);
});
