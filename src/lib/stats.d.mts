export interface Stats {
  streak: number;
  /** Local day index of the last activity, or null if never active. */
  lastActiveDay: number | null;
  todayCount: number;
  dailyGoal: number;
}

export const DEFAULT_DAILY_GOAL: number;

export function dayNumber(now: number): number;
export function createStats(): Stats;
export function registerActivity(stats: Stats, now: number): Stats;
export function goalMet(stats: Stats, now: number): boolean;
