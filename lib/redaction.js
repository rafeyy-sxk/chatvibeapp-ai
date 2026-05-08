/**
 * PII redaction utilities.
 * Detects and redacts emails, phone numbers, SSNs, credit cards, IDs, and names.
 * Used by Redaction Mode (Feature #14).
 */

const PATTERNS = {
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    label: "EMAIL",
  },
  phone: {
    pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    label: "PHONE",
  },
  ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    label: "SSN",
  },
  creditCard: {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    label: "CREDIT_CARD",
  },
  nationalId: {
    // Generic ID: 8–12 digit sequences not matched by other patterns
    pattern: /\b\d{8,12}\b/g,
    label: "ID_NUMBER",
  },
  ipAddress: {
    pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    label: "IP_ADDRESS",
  },
  url: {
    pattern: /https?:\/\/[^\s"'<>]+/g,
    label: "URL",
  },
};

/**
 * Detect all PII instances in text.
 * @param {string} text
 * @returns {Record<string, {count: number, matches: string[]}>}
 */
export function detectPII(text) {
  if (!text) return {};
  const detected = {};

  for (const [type, { pattern, label }] of Object.entries(PATTERNS)) {
    const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags))].map(
      (m) => m[0]
    );
    if (matches.length > 0) {
      detected[type] = { count: matches.length, label, matches: matches.slice(0, 5) };
    }
  }

  return detected;
}

/**
 * Redact all detected PII from text.
 * @param {string} text
 * @param {string[]} [types] - which types to redact (defaults to all)
 * @returns {{redacted: string, replacements: Record<string, number>}}
 */
export function redactPII(text, types = Object.keys(PATTERNS)) {
  if (!text) return { redacted: "", replacements: {} };

  let redacted = text;
  const replacements = {};

  for (const type of types) {
    const def = PATTERNS[type];
    if (!def) continue;

    const re = new RegExp(def.pattern.source, def.pattern.flags);
    let count = 0;
    redacted = redacted.replace(re, () => {
      count++;
      return `[${def.label}]`;
    });

    if (count > 0) replacements[type] = count;
  }

  return { redacted, replacements };
}

/**
 * Check if text contains any PII.
 * @param {string} text
 * @returns {boolean}
 */
export function hasPII(text) {
  return Object.keys(detectPII(text)).length > 0;
}

/**
 * Get a human-readable summary of PII found.
 * @param {string} text
 * @returns {string}
 */
export function piiSummary(text) {
  const detected = detectPII(text);
  const found = Object.entries(detected);
  if (found.length === 0) return "No PII detected.";
  return found
    .map(([type, { count }]) => `${count} ${type}(s)`)
    .join(", ");
}
