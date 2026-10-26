export type PatternStatus = "learning" | "practicing" | "needs-review" | "mastered";
export type ExerciseType = "translation" | "unnatural" | "situation" | "cloze" | "which-native";

// Provenance for the content pipeline (see PATTERNS_PLAN.md). Only "reviewed"
// patterns are meant to be shown to learners; candidates await human approval.
export type PatternSource = "manual" | "tatoeba" | "opus" | "llm_candidate";
export type ReviewStatus = "reviewed" | "candidate" | "rejected";

export interface Pattern {
  id: string;
  title: string;
  description: string;
  nativeThinking: string;
  literalThinking: string;
  correctEnglish: string;
  commonMistakes: string[];
  examples: string[];
  difficulty: "core" | "intermediate" | "advanced";
  relatedPatterns: string[];
  /** Content-pipeline metadata; optional so older records stay valid. */
  sourceType?: PatternSource;
  license?: string;
  reviewStatus?: ReviewStatus;
  /** The L1 (Russian) habit this pattern corrects, e.g. "verb-of-motion for events". */
  l1InterferenceTag?: string;
  /**
   * Lemma sequences that signal the target construction is present, used by the
   * offline pattern-presence layer of the grader. Each inner array is matched as
   * an ordered subsequence against the lemmatized answer; any one matching wins.
   */
  matchers?: string[][];
  prompts: {
    // RU stimulus — used only at the lowest scaffold steps.
    translation: { prompt: string; answers: string[] };
    // An unnatural English sentence to rewrite.
    unnatural: { prompt: string; answers: string[] };
    // Meaning-first: an English situation to respond to. The flagship exercise.
    situation: { prompt: string; answers: string[] };
    // An English sentence with the pattern slot blanked out.
    cloze: { prompt: string; answers: string[] };
  };
}

export const patterns: Pattern[] = [
  {
    id: "how-was-event",
    title: "How was + event",
    description:
      "English describes the quality of an event. Russian often tries to make the event 'pass', but native speakers simply ask what it was like.",
    nativeThinking: "Что это было за событие? What was the experience like?",
    literalThinking: "How did the trip pass?",
    correctEnglish: "How was your trip?",
    commonMistakes: ["How did your trip pass?", "How passed your trip?"],
    examples: [
      "How was your weekend?",
      "How was the interview?",
      "How was the exam?",
      "How was the flight?",
    ],
    difficulty: "core",
    relatedPatterns: ["occurred-to-me", "there-is-no-point"],
    matchers: [["how", "be"]],
    sourceType: "manual",
    reviewStatus: "reviewed",
    l1InterferenceTag: "verb-of-motion for events (прошла)",
    prompts: {
      translation: {
        prompt: "Как прошла поездка?",
        answers: ["How was your trip?", "How was the trip?"],
      },
      unnatural: {
        prompt: "How did your vacation pass?",
        answers: ["How was your vacation?", "How was the vacation?"],
      },
      situation: {
        prompt: "A friend asks about your conference trip.",
        answers: ["How was your conference trip?", "How was the conference trip?"],
      },
      cloze: {
        prompt: "Fill the gap: \"___ your interview?\"",
        answers: ["How was your interview?"],
      },
    },
  },
  {
    id: "occurred-to-me",
    title: "It occurred to me",
    description:
      "English uses a mental-event frame: an idea appears to you. The thought is not 'put in your head' and it is not translated as a physical motion.",
    nativeThinking: "Мне пришла мысль.",
    literalThinking: "The idea came into my head.",
    correctEnglish: "It occurred to me.",
    commonMistakes: ["I thought about it.", "The idea came to me.", "It came in my head."],
    examples: [
      "It suddenly occurred to me that I had left my phone at home.",
      "It never occurred to me to call him.",
      "It just occurred to me.",
      "Has it ever occurred to you?",
    ],
    difficulty: "core",
    relatedPatterns: ["how-was-event", "there-is-no-point"],
    matchers: [["occur", "to"]],
    sourceType: "manual",
    reviewStatus: "reviewed",
    l1InterferenceTag: "physical-motion metaphor for thoughts",
    prompts: {
      translation: {
        prompt: "Мне никогда это не приходило в голову.",
        answers: [
          "It never occurred to me.",
          "It never occurred to me to do that.",
          "It had never occurred to me.",
        ],
      },
      unnatural: {
        prompt: "The idea came to my head right now.",
        answers: ["It just occurred to me.", "It just occurred to me now."],
      },
      situation: {
        prompt: "You suddenly realize your phone is still at home.",
        answers: [
          "It suddenly occurred to me that I'd left my phone at home.",
          "It suddenly occurred to me that I had left my phone at home.",
        ],
      },
      cloze: {
        prompt: "Fill the gap: \"It suddenly ___ to me that I was wrong.\"",
        answers: [
          "It suddenly occurred to me that I was wrong.",
          "It suddenly occurred to me I was wrong.",
        ],
      },
    },
  },
  {
    id: "cant-help-but",
    title: "Can't help but + verb",
    description:
      "English often packages an involuntary reaction as something you cannot help doing. The focus is the reaction, not the literal impossibility.",
    nativeThinking: "Я не могу не улыбаться.",
    literalThinking: "I cannot not smile.",
    correctEnglish: "I can't help but smile.",
    commonMistakes: ["I don't can help to smile.", "I cannot not smile."],
    examples: [
      "I can't help but smile when I see that.",
      "I couldn't help but laugh.",
      "I can't help thinking about it.",
      "You can't help but notice the difference.",
    ],
    difficulty: "intermediate",
    relatedPatterns: ["there-is-no-point", "occurred-to-me"],
    matchers: [["can", "not", "help"], ["help", "but"]],
    sourceType: "manual",
    reviewStatus: "reviewed",
    l1InterferenceTag: "double negative (не могу не)",
    prompts: {
      translation: {
        prompt: "Я не могу не улыбаться, когда вижу это.",
        answers: ["I can't help but smile when I see that.", "I can't help but smile when I see it."],
      },
      unnatural: {
        prompt: "I cannot not smile when I see this.",
        answers: ["I can't help but smile when I see this."],
      },
      situation: {
        prompt: "You see a very awkward but funny photo from school.",
        answers: ["I can't help but laugh when I see that photo."],
      },
      cloze: {
        prompt: "Fill the gap: \"I ___ but smile when I saw it.\"",
        answers: [
          "I can't help but smile when I saw it.",
          "I couldn't help but smile when I saw it.",
        ],
      },
    },
  },
  {
    id: "there-is-no-point",
    title: "There's no point in + -ing",
    description:
      "English frames useless effort as 'point'. The pattern judges usefulness, not the literal sense of 'meaning'.",
    nativeThinking: "Нет смысла это делать.",
    literalThinking: "There is no sense to do it.",
    correctEnglish: "There's no point in doing it.",
    commonMistakes: ["There is no sense go there.", "No meaning to do it."],
    examples: [
      "There's no point in arguing now.",
      "There's no point in waiting outside.",
      "There's no point in asking him again.",
      "There's no point in going there today.",
    ],
    difficulty: "intermediate",
    relatedPatterns: ["cant-help-but", "how-was-event"],
    matchers: [["no", "point"]],
    sourceType: "manual",
    reviewStatus: "reviewed",
    l1InterferenceTag: "'sense' for usefulness (смысл)",
    prompts: {
      translation: {
        prompt: "Нет смысла идти туда сейчас.",
        answers: ["There's no point in going there now.", "There is no point in going there now."],
      },
      unnatural: {
        prompt: "There is no sense to go there now.",
        answers: ["There's no point in going there now.", "There is no point in going there now."],
      },
      situation: {
        prompt: "You want to stop a pointless argument with a colleague.",
        answers: ["There's no point in arguing about this now."],
      },
      cloze: {
        prompt: "Fill the gap: \"There's ___ in arguing now.\"",
        answers: ["There's no point in arguing now.", "There is no point in arguing now."],
      },
    },
  },
  {
    id: "make-a-decision",
    title: "Make a decision",
    description:
      "English collocates decisions with 'make'. Russian 'принять решение' pushes learners toward 'take' or 'accept', which sound wrong.",
    nativeThinking: "Я принимаю решение — I produce/create the decision.",
    literalThinking: "I take/accept a decision.",
    correctEnglish: "I need to make a decision.",
    commonMistakes: ["I need to take a decision.", "I accepted a decision.", "Let's accept a decision."],
    examples: [
      "We have to make a decision by Friday.",
      "She made the right decision.",
      "Don't make any decisions when you're tired.",
      "It's a hard decision to make.",
    ],
    difficulty: "core",
    relatedPatterns: ["it-makes-sense", "it-depends-on"],
    matchers: [["make", "decision"]],
    sourceType: "manual",
    reviewStatus: "reviewed",
    l1InterferenceTag: "take/accept collocation (принять решение)",
    prompts: {
      translation: {
        prompt: "Мне нужно принять решение.",
        answers: ["I need to make a decision.", "I have to make a decision."],
      },
      unnatural: {
        prompt: "I have to take a decision today.",
        answers: ["I have to make a decision today.", "I need to make a decision today."],
      },
      situation: {
        prompt: "Your team is waiting for you to choose between two options.",
        answers: ["I need to make a decision.", "I have to make a decision."],
      },
      cloze: {
        prompt: "Fill the gap: \"We have to ___ a decision by Friday.\"",
        answers: ["We have to make a decision by Friday."],
      },
    },
  },
  {
    id: "look-forward-to",
    title: "Look forward to + -ing",
    description:
      "English frames anticipation as looking forward to something. Russian 'с нетерпением жду' becomes a literal 'wait with impatience', which is unnatural.",
    nativeThinking: "Я предвкушаю, направляю взгляд вперёд к событию.",
    literalThinking: "I wait with impatience for the meeting.",
    correctEnglish: "I'm looking forward to the meeting.",
    commonMistakes: [
      "I wait with impatience for the meeting.",
      "I look forward to meet you.",
      "I'm looking forward to see you.",
    ],
    examples: [
      "I'm looking forward to the weekend.",
      "We look forward to hearing from you.",
      "She's looking forward to seeing them again.",
      "I look forward to working with you.",
    ],
    difficulty: "intermediate",
    relatedPatterns: ["feel-like-doing", "used-to-doing"],
    matchers: [["look", "forward", "to"]],
    sourceType: "manual",
    reviewStatus: "reviewed",
    l1InterferenceTag: "'wait with impatience' calque (с нетерпением жду)",
    prompts: {
      translation: {
        prompt: "Я с нетерпением жду встречи.",
        answers: [
          "I'm looking forward to the meeting.",
          "I am looking forward to the meeting.",
          "I'm looking forward to meeting you.",
        ],
      },
      unnatural: {
        prompt: "I wait with impatience for our meeting.",
        answers: ["I'm looking forward to our meeting.", "I am looking forward to our meeting."],
      },
      situation: {
        prompt: "You're excited about a trip next week and tell a friend.",
        answers: ["I'm looking forward to the trip.", "I'm really looking forward to the trip."],
      },
      cloze: {
        prompt: "Fill the gap: \"We ___ forward to hearing from you.\"",
        answers: ["We look forward to hearing from you."],
      },
    },
  },
  {
    id: "it-depends-on",
    title: "It depends on",
    description:
      "English uses 'depend on'. Russian 'зависит от' makes learners say 'depends from', a very common preposition slip.",
    nativeThinking: "Это зависит от обстоятельств.",
    literalThinking: "It depends from the situation.",
    correctEnglish: "It depends on the situation.",
    commonMistakes: ["It depends from the situation.", "It depends of the weather.", "Depends from you."],
    examples: [
      "It depends on the weather.",
      "That depends on what you mean.",
      "The price depends on the size.",
      "It all depends on you.",
    ],
    difficulty: "core",
    relatedPatterns: ["make-a-decision", "it-makes-sense"],
    matchers: [["depend", "on"]],
    sourceType: "manual",
    reviewStatus: "reviewed",
    l1InterferenceTag: "wrong preposition 'from' (зависит от)",
    prompts: {
      translation: {
        prompt: "Это зависит от погоды.",
        answers: ["It depends on the weather.", "That depends on the weather."],
      },
      unnatural: {
        prompt: "It depends from the weather.",
        answers: ["It depends on the weather."],
      },
      situation: {
        prompt: "A friend asks if you'll come to the picnic tomorrow.",
        answers: ["It depends on the weather.", "It depends."],
      },
      cloze: {
        prompt: "Fill the gap: \"The price depends ___ the size.\"",
        answers: ["The price depends on the size."],
      },
    },
  },
  {
    id: "used-to-doing",
    title: "Be used to + -ing",
    description:
      "English expresses habituation with 'be used to + -ing'. Russian 'я привык' tempts learners into 'I am accustomed' or the unrelated 'used to' (past habit).",
    nativeThinking: "Я привык к чему-то — это для меня привычно.",
    literalThinking: "I am accustomed to wake up early. / I used to wake up early.",
    correctEnglish: "I'm used to waking up early.",
    commonMistakes: [
      "I used to wake up early.",
      "I am used to wake up early.",
      "I am accustomed to wake up early.",
    ],
    examples: [
      "I'm used to working late.",
      "She's not used to the cold yet.",
      "You'll get used to it.",
      "We're used to living in a big city.",
    ],
    difficulty: "advanced",
    relatedPatterns: ["look-forward-to", "feel-like-doing"],
    matchers: [["use", "to"]],
    sourceType: "manual",
    reviewStatus: "reviewed",
    l1InterferenceTag: "habit vs past-habit confusion (привык)",
    prompts: {
      translation: {
        prompt: "Я привык вставать рано.",
        answers: ["I'm used to waking up early.", "I am used to waking up early."],
      },
      unnatural: {
        prompt: "I am used to wake up early.",
        answers: ["I'm used to waking up early.", "I am used to waking up early."],
      },
      situation: {
        prompt: "Someone is surprised you work late every day.",
        answers: ["I'm used to working late.", "I am used to working late."],
      },
      cloze: {
        prompt: "Fill the gap: \"Don't worry, you'll get ___ to it.\"",
        answers: ["Don't worry, you'll get used to it."],
      },
    },
  },
  {
    id: "it-makes-sense",
    title: "It makes sense",
    description:
      "English says something 'makes sense'. Russian 'это имеет смысл' becomes a literal 'has sense', which native speakers don't say.",
    nativeThinking: "Это осмысленно, это логично.",
    literalThinking: "It has sense. / It has a sense.",
    correctEnglish: "That makes sense.",
    commonMistakes: ["It has sense.", "It has a sense.", "This has no sense."],
    examples: [
      "That makes sense.",
      "It doesn't make sense to wait.",
      "Does that make sense?",
      "Now it all makes sense.",
    ],
    difficulty: "core",
    relatedPatterns: ["there-is-no-point", "it-depends-on"],
    matchers: [["make", "sense"]],
    sourceType: "manual",
    reviewStatus: "reviewed",
    l1InterferenceTag: "'have sense' calque (иметь смысл)",
    prompts: {
      translation: {
        prompt: "Это имеет смысл.",
        answers: ["That makes sense.", "It makes sense."],
      },
      unnatural: {
        prompt: "It has sense to leave now.",
        answers: ["It makes sense to leave now."],
      },
      situation: {
        prompt: "A colleague explains a plan and it sounds logical to you.",
        answers: ["That makes sense.", "Yeah, that makes sense."],
      },
      cloze: {
        prompt: "Fill the gap: \"It doesn't ___ sense to wait.\"",
        answers: ["It doesn't make sense to wait."],
      },
    },
  },
  {
    id: "feel-like-doing",
    title: "Feel like + -ing",
    description:
      "English expresses an urge with 'feel like + -ing'. Russian 'мне хочется' or 'я чувствую себя' leads to 'I feel myself' or a bare 'I want'.",
    nativeThinking: "Мне хочется чего-то прямо сейчас.",
    literalThinking: "I feel myself like coffee. / I want to drink coffee.",
    correctEnglish: "I feel like having some coffee.",
    commonMistakes: ["I feel myself like coffee.", "I feel like to drink coffee.", "I have a wish to drink coffee."],
    examples: [
      "I feel like going for a walk.",
      "I don't feel like cooking tonight.",
      "Do you feel like grabbing lunch?",
      "She felt like crying.",
    ],
    difficulty: "intermediate",
    relatedPatterns: ["look-forward-to", "used-to-doing"],
    matchers: [["feel", "like"]],
    sourceType: "manual",
    reviewStatus: "reviewed",
    l1InterferenceTag: "'feel myself' reflexive calque (чувствую себя)",
    prompts: {
      translation: {
        prompt: "Мне хочется прогуляться.",
        answers: ["I feel like going for a walk.", "I feel like taking a walk."],
      },
      unnatural: {
        prompt: "I feel myself like a walk.",
        answers: ["I feel like going for a walk.", "I feel like taking a walk."],
      },
      situation: {
        prompt: "It's late and you really don't want to cook.",
        answers: ["I don't feel like cooking tonight.", "I don't feel like cooking."],
      },
      cloze: {
        prompt: "Fill the gap: \"Do you ___ like grabbing lunch?\"",
        answers: ["Do you feel like grabbing lunch?"],
      },
    },
  },
];
