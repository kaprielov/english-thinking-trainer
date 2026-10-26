export type Grade = "correct" | "almost" | "wrong" | "ungraded";

export interface LlmRubric {
  usesPattern: boolean;
  grammatical: boolean;
  natural: boolean;
}

export interface LocalGradeInput {
  exerciseType: string;
  answer: string;
  acceptedAnswers?: string[];
  matchers?: string[][];
}

export interface LocalGradeResult {
  /** Whether the deterministic pass finalized a grade without the LLM. */
  decided: boolean;
  grade: Grade | null;
  /** Whether the target construction was detected in the answer. */
  usesPattern: boolean;
  exactMatch: boolean;
}

export function normalizeAnswer(value: string): string;
export function isAnswerCorrect(answer: string, acceptedAnswers: string[]): boolean;

export function lemmatizeToken(token: string): string;
export function lemmatize(text: string): string[];
export function matchesPattern(matchers: string[][] | undefined, answer: string): boolean;

export function localGrade(input: LocalGradeInput): LocalGradeResult;
export function combineWithLLM(local: LocalGradeResult, rubric: LlmRubric | null | undefined): Grade;
export function offlineGrade(local: LocalGradeResult): Grade;
