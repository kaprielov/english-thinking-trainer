// Hybrid answer grader.
//
// Layered decision so that progress is deterministic and offline-safe, and the
// LLM is only an adjudicator for the ambiguous "is it natural?" cases:
//   1. normalize            -> normalizeAnswer
//   2. deterministic accept -> isAnswerCorrect
//   3. pattern presence      -> lemmatize + matchesPattern (works offline)
//   4. LLM rubric            -> combineWithLLM (only when steps 1-3 don't decide)
//   5. offline / API error   -> offlineGrade => "ungraded" (never a silent mistake)
//
// Written as plain JS (with grading.d.ts types) so it can be unit-tested with
// `node --test` directly and reused by both the client and the API server.

/** @typedef {"correct" | "almost" | "wrong" | "ungraded"} Grade */

// --- text primitives (shared home for these; session.ts re-exports them) ---

export function normalizeAnswer(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[.,!?;:()[\]{}]/g, "")
    .replace(/\s+/g, " ");
}

export function isAnswerCorrect(answer, acceptedAnswers) {
  const normalized = normalizeAnswer(answer);
  if (!normalized) return false;
  return acceptedAnswers.some((candidate) => normalizeAnswer(candidate) === normalized);
}

// --- lightweight lemmatizer (rule-based, no dependencies) ---

const CONTRACTIONS = {
  "can't": "can not",
  cannot: "can not",
  "won't": "will not",
  "shan't": "shall not",
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "couldn't": "could not",
  "wouldn't": "would not",
  "shouldn't": "should not",
  "mustn't": "must not",
  "it's": "it is",
  "that's": "that is",
  "there's": "there is",
  "here's": "here is",
  "what's": "what is",
  "who's": "who is",
  "he's": "he is",
  "she's": "she is",
  "let's": "let us",
  "i'm": "i am",
  "you're": "you are",
  "we're": "we are",
  "they're": "they are",
  "i've": "i have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "i'll": "i will",
  "you'll": "you will",
  "we'll": "we will",
  "they'll": "they will",
  "he'll": "he will",
  "she'll": "she will",
  "i'd": "i would",
  "you'd": "you would",
};

const IRREGULAR = {
  was: "be",
  were: "be",
  is: "be",
  are: "be",
  am: "be",
  been: "be",
  being: "be",
  be: "be",
  had: "have",
  has: "have",
  have: "have",
  having: "have",
  did: "do",
  does: "do",
  done: "do",
  doing: "do",
  do: "do",
  went: "go",
  gone: "go",
  goes: "go",
  going: "go",
  got: "get",
  gotten: "get",
  said: "say",
  came: "come",
  // Silent-e verbs whose -ing/-ed/-es forms the suffix rules would over-strip.
  make: "make",
  makes: "make",
  making: "make",
  made: "make",
  take: "take",
  takes: "take",
  taking: "take",
  took: "take",
  taken: "take",
  use: "use",
  uses: "use",
  using: "use",
  used: "use",
  feel: "feel",
  feels: "feel",
  feeling: "feel",
  felt: "feel",
};

function dedouble(base) {
  const last = base[base.length - 1];
  if (base.length > 2 && last === base[base.length - 2] && !"aeiou".includes(last)) {
    return base.slice(0, -1);
  }
  return base;
}

export function lemmatizeToken(token) {
  if (IRREGULAR[token]) return IRREGULAR[token];
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("ing")) return dedouble(token.slice(0, -3));
  if (token.length > 3 && token.endsWith("ed")) return dedouble(token.slice(0, -2));
  if (token.length > 3 && token.endsWith("es")) {
    // Sibilant clusters keep the "e" (watches->watch); otherwise drop only "s"
    // so silent-e verbs survive (makes->make, not "mak").
    return /(?:s|x|z|ch|sh)es$/.test(token) ? token.slice(0, -2) : token.slice(0, -1);
  }
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function lemmatize(text) {
  let expanded = String(text).toLowerCase();
  for (const [contraction, full] of Object.entries(CONTRACTIONS)) {
    expanded = expanded.replace(new RegExp(`\\b${contraction}\\b`, "g"), full);
  }
  return expanded
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(lemmatizeToken);
}

function isOrderedSubsequence(sequence, tokens) {
  let i = 0;
  for (const token of tokens) {
    if (token === sequence[i]) i += 1;
    if (i === sequence.length) return true;
  }
  return sequence.length === 0;
}

/**
 * True when any matcher (a sequence of lemmas) appears as an ordered
 * subsequence of the lemmatized answer. Returns false when there are no
 * matchers to test against.
 */
export function matchesPattern(matchers, answer) {
  if (!Array.isArray(matchers) || matchers.length === 0) return false;
  const tokens = lemmatize(answer);
  return matchers.some((sequence) => isOrderedSubsequence(sequence, tokens));
}

// --- grading layers ---

/**
 * Deterministic first pass. Decides on its own for exact matches and for
 * closed-set recognition; otherwise defers (decided:false) to the LLM rubric,
 * reporting whether the target construction is present.
 */
// Choice-based exercises are a closed set: always decidable offline, never
// deferred to the LLM.
const CLOSED_CHOICE_TYPES = new Set(["which-native", "recognition"]);

export function localGrade(input) {
  const { exerciseType, answer, acceptedAnswers = [], matchers } = input;
  const exact = isAnswerCorrect(answer, acceptedAnswers);

  if (CLOSED_CHOICE_TYPES.has(exerciseType)) {
    return { decided: true, grade: exact ? "correct" : "wrong", usesPattern: exact, exactMatch: exact };
  }

  if (exact) {
    return { decided: true, grade: "correct", usesPattern: true, exactMatch: true };
  }

  return {
    decided: false,
    grade: null,
    usesPattern: matchesPattern(matchers, answer),
    exactMatch: false,
  };
}

/**
 * Fold an LLM rubric into a final grade. If the local pass already decided,
 * the LLM never overrides it.
 */
export function combineWithLLM(local, rubric) {
  if (local.decided && local.grade) return local.grade;
  if (!rubric) return "ungraded";

  const usesPattern = Boolean(rubric.usesPattern) || local.usesPattern;
  const grammatical = Boolean(rubric.grammatical);
  const natural = Boolean(rubric.natural);

  if (usesPattern && grammatical && natural) return "correct";
  if (usesPattern && (grammatical || natural)) return "almost";
  return "wrong";
}

/** Grade used when the LLM is unreachable: keep decided results, else leave it ungraded. */
export function offlineGrade(local) {
  if (local.decided && local.grade) return local.grade;
  return "ungraded";
}
