import test from "node:test";
import assert from "node:assert/strict";

import {
  combineWithLLM,
  isAnswerCorrect,
  lemmatize,
  lemmatizeToken,
  localGrade,
  matchesPattern,
  offlineGrade,
} from "../src/lib/grading.mjs";

test("lemmatizeToken normalizes verb forms and irregulars", () => {
  assert.equal(lemmatizeToken("occurred"), "occur");
  assert.equal(lemmatizeToken("occurs"), "occur");
  assert.equal(lemmatizeToken("was"), "be");
  assert.equal(lemmatizeToken("going"), "go");
  assert.equal(lemmatizeToken("points"), "point");
  assert.equal(lemmatizeToken("studies"), "study");
});

test("lemmatizeToken keeps silent-e verbs intact across inflections", () => {
  for (const form of ["make", "makes", "making", "made"]) assert.equal(lemmatizeToken(form), "make");
  for (const form of ["take", "takes", "taking", "took"]) assert.equal(lemmatizeToken(form), "take");
  for (const form of ["use", "uses", "using", "used"]) assert.equal(lemmatizeToken(form), "use");
  for (const form of ["feel", "feels", "feeling", "felt"]) assert.equal(lemmatizeToken(form), "feel");
  assert.equal(lemmatizeToken("depends"), "depend");
  assert.equal(lemmatizeToken("watches"), "watch");
});

test("lemmatize expands contractions and tokenizes", () => {
  assert.deepEqual(lemmatize("I can't help but smile"), ["i", "can", "not", "help", "but", "smile"]);
  assert.deepEqual(lemmatize("There's no point"), ["there", "be", "no", "point"]);
});

test("matchesPattern detects the target construction as an ordered subsequence", () => {
  assert.equal(matchesPattern([["occur", "to"]], "It occurred to me yesterday"), true);
  assert.equal(matchesPattern([["how", "be"]], "How was your trip?"), true);
  assert.equal(matchesPattern([["no", "point"]], "There's no point in waiting"), true);
  assert.equal(matchesPattern([["help", "but"]], "I couldn't help but laugh"), true);
  // wrong order / absent
  assert.equal(matchesPattern([["occur", "to"]], "to whom did it occur"), false);
  assert.equal(matchesPattern([["no", "point"]], "I thought about it"), false);
  assert.equal(matchesPattern(undefined, "anything"), false);
});

test("isAnswerCorrect ignores punctuation/case and rejects empty answers", () => {
  assert.equal(isAnswerCorrect("How was your trip?", ["how was your trip"]), true);
  assert.equal(isAnswerCorrect("  HOW  was your TRIP  ", ["How was your trip?"]), true);
  assert.equal(isAnswerCorrect("", ["how was your trip"]), false);
});

test("localGrade decides exact matches offline without deferring to the LLM", () => {
  const result = localGrade({
    exerciseType: "translation",
    answer: "How was your trip?",
    acceptedAnswers: ["How was your trip?"],
    matchers: [["how", "be"]],
  });
  assert.equal(result.decided, true);
  assert.equal(result.grade, "correct");
});

test("localGrade defers non-exact answers but reports pattern presence", () => {
  const result = localGrade({
    exerciseType: "translation",
    answer: "How was the flight yesterday",
    acceptedAnswers: ["How was your trip?"],
    matchers: [["how", "be"]],
  });
  assert.equal(result.decided, false);
  assert.equal(result.grade, null);
  assert.equal(result.usesPattern, true);
});

test("localGrade decides which-native locally as a closed set", () => {
  const correct = localGrade({
    exerciseType: "which-native",
    answer: "How was your trip?",
    acceptedAnswers: ["How was your trip?"],
  });
  assert.equal(correct.decided, true);
  assert.equal(correct.grade, "correct");

  const wrong = localGrade({
    exerciseType: "which-native",
    answer: "How did your trip pass?",
    acceptedAnswers: ["How was your trip?"],
  });
  assert.equal(wrong.decided, true);
  assert.equal(wrong.grade, "wrong");
});

test("combineWithLLM folds a rubric into a graded verdict", () => {
  const undecided = { decided: false, grade: null, usesPattern: true, exactMatch: false };
  assert.equal(combineWithLLM(undecided, { usesPattern: true, grammatical: true, natural: true }), "correct");
  assert.equal(combineWithLLM(undecided, { usesPattern: true, grammatical: true, natural: false }), "almost");
  assert.equal(combineWithLLM(undecided, { usesPattern: false, grammatical: false, natural: false }), "wrong");
  // decided results are never overridden by the LLM
  const decided = { decided: true, grade: "correct", usesPattern: true, exactMatch: true };
  assert.equal(combineWithLLM(decided, { usesPattern: false, grammatical: false, natural: false }), "correct");
});

test("offlineGrade never turns an undecided answer into a mistake", () => {
  assert.equal(offlineGrade({ decided: false, grade: null, usesPattern: true, exactMatch: false }), "ungraded");
  assert.equal(offlineGrade({ decided: true, grade: "correct", usesPattern: true, exactMatch: true }), "correct");
});
