import type { Grade } from "@/lib/grading.mjs";

export interface SrsState {
  /** Consecutive successful reviews (SM-2 repetition count). */
  reps: number;
  lapses: number;
  /** SM-2 ease factor (analogue of FSRS difficulty). */
  ease: number;
  /** Current interval in days (analogue of FSRS stability). */
  intervalDays: number;
  /** Epoch ms when this pattern is next due. */
  dueAt: number;
  /** Epoch ms of the last review, or null if never reviewed. */
  lastReviewedAt: number | null;
}

export interface NextPatternOptions {
  maxLearning?: number;
}

export const DEFAULT_EASE: number;

export function createSrsState(now: number): SrsState;
export function gradeToQuality(grade: Grade): number | null;
export function scheduleNext(state: SrsState, grade: Grade, now: number): SrsState;
export function isNew(state: SrsState | undefined): boolean;
export function scaffoldStep(state: SrsState | undefined): number;
export function isDue(state: SrsState | undefined, now: number): boolean;
export function learningCount(srsMap: Record<string, SrsState>): number;
export function dueCount(srsMap: Record<string, SrsState>, now: number): number;
export function canIntroduceNew(srsMap: Record<string, SrsState>, options?: NextPatternOptions): boolean;
export function rankByPriority(patternIds: string[], srsMap: Record<string, SrsState>, now: number): string[];
export function nextPatternId(
  patternIds: string[],
  srsMap: Record<string, SrsState>,
  now: number,
  options?: NextPatternOptions,
): string;
export function pickDueForReview(
  patternIds: string[],
  srsMap: Record<string, SrsState>,
  now: number,
  excludeId: string,
): string | null;
