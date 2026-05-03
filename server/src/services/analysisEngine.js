// Core Phase 2 analytics engine for ChatVibe AI.
// This module is intentionally self-contained (no external NLP deps).
// It operates purely on OCR-extracted raw text.

// PII Detection patterns
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(\+?\d{1,3}[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  address: /\b\d+\s+[A-Za-z0-9\s,.-]+\b/g, // Basic address pattern
  name: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, // Basic name pattern
};

function detectPII(text) {
  const detected = {};
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches) {
      detected[type] = matches.length;
    }
  }
  return detected;
}

function sanitizeText(text) {
  let sanitized = text;
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    sanitized = sanitized.replace(pattern, `[REDACTED_${type.toUpperCase()}]`);
  }
  return sanitized;
}

function normalizeText(text) {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function splitMessages(rawText) {
  const cleaned = (rawText || "").replace(/\r\n/g, "\n");
  const lines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Very lightweight grouping: treat each non-empty line as a message.
  // Later phases can upgrade this to structured speaker attribution.
  return lines.map((content, index) => ({
    index,
    content,
  }));
}

// Sentiment scoring using extremely simple lexicons.
const POSITIVE_WORDS = [
  "love",
  "like",
  "great",
  "amazing",
  "good",
  "nice",
  "sweet",
  "cute",
  "fun",
  "happy",
  "excited",
  "glad",
  "thank",
  "thanks",
  "sorry in a good way",
];

const NEGATIVE_WORDS = [
  "hate",
  "annoy",
  "mad",
  "angry",
  "upset",
  "sad",
  "tired of you",
  "stupid",
  "idiot",
  "wtf",
  "fuck you",
  "leave me alone",
  "disappointed",
  "anxious",
];

function sentimentForMessage(text) {
  const lower = (text || "").toLowerCase();
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE_WORDS) {
    if (lower.includes(w)) pos += 1;
  }
  for (const w of NEGATIVE_WORDS) {
    if (lower.includes(w)) neg += 1;
  }
  if (pos === 0 && neg === 0) return 0;
  const score = (pos - neg) / (pos + neg);
  return Number(score.toFixed(3));
}

function buildSentimentTimeline(messages) {
  return messages.map((m) => ({
    index: m.index,
    sentiment: sentimentForMessage(m.content),
  }));
}

// Toxicity analysis – again, very lightweight keyword heuristics.
const TOXIC_WORDS = [
  "hate",
  "stupid",
  "idiot",
  "dumb",
  "loser",
  "shut up",
  "kill yourself",
  "kys",
  "bitch",
  "asshole",
  "toxic",
  "gaslight",
  "manipulate",
  "crazy",
];

function toxicityScore(text) {
  const lower = (text || "").toLowerCase();
  let hits = 0;
  for (const w of TOXIC_WORDS) {
    if (lower.includes(w)) hits += 1;
  }
  if (!hits) return 0;
  // Cap per-message toxicity between 0–1.
  return Math.min(1, hits / 3);
}

function buildToxicity(messages) {
  const perMessage = messages.map((m) => ({
    index: m.index,
    score: toxicityScore(m.content),
  }));
  const average =
    perMessage.length === 0
      ? 0
      : perMessage.reduce((sum, m) => sum + m.score, 0) / perMessage.length;
  const spikes = perMessage.filter((m) => m.score >= 0.6).map((m) => m.index);
  return {
    average: Number(average.toFixed(3)),
    perMessage,
    spikes,
  };
}

// Responsiveness – we do not have reliable timestamps from OCR, so we expose a
// placeholder structure and reserve actual timing logic for a future phase that
// feeds parsed timestamps into this engine.
function buildResponsiveness(messages) {
  return {
    // Always present fields; currently null until we add timestamp extraction.
    averageDelayMs: null,
    bySpeaker: {},
    messageCount: messages.length,
    notes:
      "Timing data not available from OCR text; upgrade parser to include timestamps to enable this metric.",
  };
}

// Dominance – approximate via word counts; if we cannot reliably detect
// speakers we treat the conversation as single-stream.
function buildDominance(messages) {
  const totalWords = messages.reduce((sum, m) => {
    const words = m.content.split(/\s+/).filter(Boolean);
    return sum + words.length;
  }, 0);

  if (!totalWords) {
    return {
      speakers: {},
      totalWords: 0,
      notes: "No words detected in OCR text.",
    };
  }

  // Basic heuristic: alternate messages as speakerA / speakerB.
  const speakers = {
    A: 0,
    B: 0,
  };

  messages.forEach((m) => {
    const words = m.content.split(/\s+/).filter(Boolean).length;
    const key = m.index % 2 === 0 ? "A" : "B";
    speakers[key] += words;
  });

  const dominance = {};
  Object.entries(speakers).forEach(([name, words]) => {
    if (words === 0) return;
    dominance[name] = Number(((words / totalWords) * 100).toFixed(1));
  });

  return {
    speakers: dominance,
    totalWords,
    notes:
      "Speaker identities are approximated by alternating messages; integrate structured speaker labels for higher accuracy.",
  };
}

// Keyword clustering – extremely simple term frequency extraction.
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "i",
  "you",
  "he",
  "she",
  "they",
  "we",
  "it",
  "to",
  "in",
  "on",
  "at",
  "for",
  "of",
  "is",
  "are",
  "was",
  "were",
  "be",
  "am",
  "not",
  "this",
  "that",
  "with",
  "my",
  "your",
  "me",
  "so",
  "just",
  "like",
  "okay",
  "ok",
]);

function buildKeywordClusters(text) {
  const norm = normalizeText(text).toLowerCase();
  if (!norm) return [];

  const tokens = norm
    .split(/[^a-z0-9#@]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  const freq = new Map();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }

  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  return sorted.map(([keyword, count]) => ({
    keyword,
    count,
  }));
}

// Behavior flags – rule-based detection driven by simple phrase matching.
const FLAG_PATTERNS = {
  anxious: [
    "are you mad",
    "are you angry",
    "did i do something",
    "sorry if",
    "sorry for",
    "overthinking",
    "i'm scared",
    "i am scared",
    "i'm worried",
    "i am worried",
  ],
  avoidant: [
    "i don't want to talk",
    "can we not",
    "leave it",
    "forget it",
    "whatever",
    "i'm busy",
    "i am busy",
    "stop texting",
  ],
  manipulation: [
    "if you loved me",
    "if you really cared",
    "you always",
    "you never",
    "no one else will",
    "you're crazy",
    "gaslight",
  ],
  clinginess: [
    "why didn't you reply",
    "why arent you replying",
    "why are you not replying",
    "text me back",
    "reply now",
    "where are you",
    "i miss you so much",
  ],
  indifference: [
    "k",
    "ok.",
    "sure.",
    "whatever",
    "idc",
    "don't care",
    "do what you want",
  ],
  inconsistency: [
    "you said before",
    "last time you said",
    "you keep changing",
    "you keep switching",
  ],
};

function buildBehaviorFlags(text) {
  const lower = (text || "").toLowerCase();
  const flags = {};
  const details = [];

  Object.entries(FLAG_PATTERNS).forEach(([key, patterns]) => {
    const hits = patterns.filter((p) => lower.includes(p));
    if (hits.length) {
      flags[key] = true;
      details.push({ type: key, matches: hits });
    } else {
      flags[key] = false;
    }
  });

  return {
    ...flags,
    details,
  };
}

export function runAnalysisEngine(rawText) {
  const piiDetected = detectPII(rawText);
  const sanitizedText = sanitizeText(rawText);

  const messages = splitMessages(sanitizedText);
  const sentimentTimeline = buildSentimentTimeline(messages);
  const toxicity = buildToxicity(messages);
  const responsiveness = buildResponsiveness(messages);
  const dominance = buildDominance(messages);
  const keywordClusters = buildKeywordClusters(sanitizedText);
  const behaviorFlags = buildBehaviorFlags(sanitizedText);

  return {
    sentimentTimeline,
    toxicity,
    responsiveness,
    dominance,
    keywordClusters,
    behaviorFlags,
    piiDetected,
    sanitizedText,
  };
}

export default runAnalysisEngine;


