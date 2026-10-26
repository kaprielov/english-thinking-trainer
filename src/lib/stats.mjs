// Habit loop: daily streak + daily goal. Pure functions take `now` (epoch ms)
// so the day-rollover logic is deterministic and unit-testable.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-time day index (days since epoch, adjusted for the timezone offset). */
export function dayNumber(now) {
  const offsetMs = new Date(now).getTimezoneOffset() * 60 * 1000;
  return Math.floor((now - offsetMs) / DAY_MS);
}

export const DEFAULT_DAILY_GOAL = 20;

export function createStats() {
  return {
    streak: 0,
    lastActiveDay: null,
    todayCount: 0,
    dailyGoal: DEFAULT_DAILY_GOAL,
  };
}

/**
 * Record one graded exercise. Extends the streak on the first activity of a new
 * consecutive day, resets it after a gap, and rolls the daily counter over.
 */
export function registerActivity(stats, now) {
  const day = dayNumber(now);

  if (stats.lastActiveDay === day) {
    return { ...stats, todayCount: stats.todayCount + 1 };
  }

  const isConsecutive = stats.lastActiveDay === day - 1;
  return {
    ...stats,
    streak: isConsecutive ? stats.streak + 1 : 1,
    lastActiveDay: day,
    todayCount: 1,
  };
}

/** Whether the learner has met today's goal (and the streak is current). */
export function goalMet(stats, now) {
  return stats.lastActiveDay === dayNumber(now) && stats.todayCount >= stats.dailyGoal;
}
