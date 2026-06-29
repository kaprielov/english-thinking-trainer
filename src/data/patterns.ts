export type PatternStatus = "learning" | "practicing" | "needs-review" | "mastered";
export type ExerciseType = "translation" | "unnatural" | "situation" | "recognition";

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
  prompts: {
    translation: { prompt: string; answers: string[] };
    unnatural: { prompt: string; answers: string[] };
    situation: { prompt: string; answers: string[] };
    recognition: { prompt: string; answer: string };
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
      recognition: {
        prompt: "Which pattern is this: \"How was your interview?\"",
        answer: "How was + event",
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
      recognition: {
        prompt: "Which pattern is this: \"It never occurred to me.\"",
        answer: "It occurred to me",
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
      recognition: {
        prompt: "Which pattern is this: \"I couldn't help but laugh.\"",
        answer: "Can't help but + verb",
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
      recognition: {
        prompt: "Which pattern is this: \"There is no point in waiting.\"",
        answer: "There's no point in + -ing",
      },
    },
  },
];
