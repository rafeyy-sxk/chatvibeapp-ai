/**
 * Confidence scoring utilities.
 * OCR confidence: derived from Tesseract word confidence arrays.
 * AI confidence: heuristic based on certainty language in Ollama output.
 */

const THRESHOLDS = { high: 0.8, medium: 0.55 };
const OCR_THRESHOLDS = { high: 0.85, medium: 0.6 };

const HIGH_CONFIDENCE_TERMS = [
  "clearly", "definitely", "certainly", "obviously", "strongly indicates",
  "evident", "apparent", "unmistakably", "without doubt", "confidently",
];

const LOW_CONFIDENCE_TERMS = [
  "possibly", "might", "perhaps", "unclear", "ambiguous", "uncertain",
  "hard to say", "difficult to determine", "may or may not", "inconclusive",
  "not enough", "limited information",
];

/**
 * Calculate OCR confidence from Tesseract word confidence data.
 * @param {Array<{confidence: number}>} words - Tesseract word objects
 * @returns {{score: number, level: "high"|"medium"|"low", wordCount: number}}
 */
export function calculateOcrConfidence(words) {
  if (!Array.isArray(words) || words.length === 0) {
    return { score: 0, level: "low", wordCount: 0 };
  }

  const validWords = words.filter((w) => w.confidence >= 0);
  if (validWords.length === 0) return { score: 0, level: "low", wordCount: 0 };

  const avg = validWords.reduce((sum, w) => sum + w.confidence, 0) / validWords.length;
  const score = Math.round(avg) / 100;

  return {
    score: parseFloat(score.toFixed(3)),
    level: score >= OCR_THRESHOLDS.high ? "high" : score >= OCR_THRESHOLDS.medium ? "medium" : "low",
    wordCount: validWords.length,
  };
}

/**
 * Estimate AI analysis confidence from Ollama response text.
 * Uses heuristic keyword matching — not a calibrated probability.
 * @param {string} responseText
 * @returns {{score: number, level: "high"|"medium"|"low"}}
 */
export function calculateAiConfidence(responseText) {
  if (!responseText || typeof responseText !== "string") {
    return { score: 0.5, level: "medium" };
  }

  const lower = responseText.toLowerCase();
  let score = 0.7; // baseline

  HIGH_CONFIDENCE_TERMS.forEach((term) => {
    if (lower.includes(term)) score = Math.min(0.97, score + 0.04);
  });

  LOW_CONFIDENCE_TERMS.forEach((term) => {
    if (lower.includes(term)) score = Math.max(0.25, score - 0.06);
  });

  // Penalize very short responses
  if (responseText.length < 100) score = Math.max(0.25, score - 0.15);

  return {
    score: parseFloat(score.toFixed(3)),
    level: score >= THRESHOLDS.high ? "high" : score >= THRESHOLDS.medium ? "medium" : "low",
  };
}

/**
 * Combined confidence summary for a completed analysis job.
 * @param {{ocrWords?: Array, aiResponse?: string}} params
 * @returns {{ocr: object, ai: object, overall: "high"|"medium"|"low"}}
 */
export function getConfidenceSummary({ ocrWords, aiResponse }) {
  const ocr = calculateOcrConfidence(ocrWords || []);
  const ai = calculateAiConfidence(aiResponse || "");
  const combined = (ocr.score + ai.score) / 2;
  const overall = combined >= THRESHOLDS.high ? "high" : combined >= THRESHOLDS.medium ? "medium" : "low";
  return { ocr, ai, overall };
}
