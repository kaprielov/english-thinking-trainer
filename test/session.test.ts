import assert from "node:assert/strict";
import { test } from "node:test";
import { patterns } from "../src/data/patterns";
import { buildExercise } from "../src/lib/session";
import { localGrade } from "../src/lib/grading.mjs";

test("an example for the pattern cannot satisfy an unrelated exercise", () => {
  const pattern = patterns[0];
  const exercise = buildExercise(pattern, "cloze", 0);
  assert.deepEqual(exercise.acceptedAnswers, pattern.prompts.cloze.answers);
  const local = localGrade({
    exerciseType: exercise.type,
    answer: pattern.correctEnglish,
    acceptedAnswers: exercise.acceptedAnswers,
    matchers: pattern.matchers,
  });
  assert.equal(local.decided, false);
  const accepted = localGrade({
    exerciseType: exercise.type,
    answer: exercise.acceptedAnswers[0],
    acceptedAnswers: exercise.acceptedAnswers,
  });
  assert.equal(accepted.grade, "correct");
});
