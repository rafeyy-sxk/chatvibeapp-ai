/**
 * Chat Feature Extractor
 * 
 * Extracts linguistic, emotional, social, and relationship features from chat text
 */

/**
 * Extract features from chat text
 * @param {string} text - Raw chat text
 * @param {object} geminiSummary - Gemini analysis summary (optional)
 * @returns {object} - Extracted features
 */
export function extractChatFeatures(text, geminiSummary = null) {
  const messages = splitMessages(text);
  
  return {
    // Linguistic features
    linguistic: extractLinguisticFeatures(text, messages),
    
    // Emotional features
    emotional: extractEmotionalFeatures(text, messages, geminiSummary),
    
    // Social features
    social: extractSocialFeatures(messages),
    
    // Relationship features
    relationship: extractRelationshipFeatures(messages, geminiSummary),
    
    // Temporal features
    temporal: extractTemporalFeatures(messages),
  };
}

/**
 * Split text into individual messages
 * @param {string} text - Chat text
 * @returns {Array<{text: string, timestamp?: string}>} - Array of messages
 */
function splitMessages(text) {
  // Simple message splitting - can be enhanced with regex patterns
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const messages = [];
  
  for (const line of lines) {
    // Try to extract timestamp (common patterns: [HH:MM], (HH:MM), etc.)
    const timestampMatch = line.match(/(\[?\d{1,2}:\d{2}\]?|\(\d{1,2}:\d{2}\))/);
    const timestamp = timestampMatch ? timestampMatch[0] : null;
    const messageText = line.replace(/(\[?\d{1,2}:\d{2}\]?|\(\d{1,2}:\d{2}\))/, '').trim();
    
    if (messageText.length > 0) {
      messages.push({ text: messageText, timestamp });
    }
  }
  
  return messages;
}

/**
 * Extract linguistic features
 */
function extractLinguisticFeatures(text, messages) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
    avgMessageLength: messages.length > 0 
      ? messages.reduce((sum, m) => sum + m.text.length, 0) / messages.length 
      : 0,
    punctuationDensity: (text.match(/[.!?,;:]/g) || []).length / Math.max(text.length, 1),
    emojiCount: (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length,
    emojiDensity: (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length / Math.max(messages.length, 1),
    uppercaseRatio: (text.match(/[A-Z]/g) || []).length / Math.max(text.length, 1),
    questionCount: (text.match(/\?/g) || []).length,
    exclamationCount: (text.match(/!/g) || []).length,
  };
}

/**
 * Extract emotional features
 */
function extractEmotionalFeatures(text, messages, geminiSummary) {
  const baseFeatures = {
    sentimentScore: calculateSentiment(text),
    emotionalIntensity: calculateEmotionalIntensity(text),
    positiveWordCount: countWords(text, POSITIVE_WORDS),
    negativeWordCount: countWords(text, NEGATIVE_WORDS),
    neutralWordCount: countWords(text, NEUTRAL_WORDS),
  };
  
  // Enhance with Gemini summary if available
  if (geminiSummary && geminiSummary.metrics) {
    return {
      ...baseFeatures,
      flirty: geminiSummary.metrics.flirty || 0,
      passiveAggressive: geminiSummary.metrics.passive_aggressive || 0,
      friendly: geminiSummary.metrics.friendly || 0,
      romantic: geminiSummary.metrics.romantic || 0,
      dryEnergy: geminiSummary.metrics.dry_energy || 0,
      angry: geminiSummary.metrics.angry || 0,
      confused: geminiSummary.metrics.confused || 0,
    };
  }
  
  return baseFeatures;
}

/**
 * Extract social features
 */
function extractSocialFeatures(messages) {
  const messageLengths = messages.map(m => m.text.length);
  const avgLength = messageLengths.reduce((a, b) => a + b, 0) / Math.max(messageLengths.length, 1);
  
  return {
    messageCount: messages.length,
    avgMessageLength: avgLength,
    shortMessageCount: messages.filter(m => m.text.length < 10).length,
    longMessageCount: messages.filter(m => m.text.length > 100).length,
    oneWordResponses: messages.filter(m => m.text.split(/\s+/).length === 1).length,
    responseTimePattern: 'unknown', // Would need timestamps to calculate
    engagementLevel: calculateEngagementLevel(messages),
  };
}

/**
 * Extract relationship features
 */
function extractRelationshipFeatures(messages, geminiSummary) {
  const baseFeatures = {
    powerDynamics: 'balanced', // Would need more sophisticated analysis
    engagementBalance: calculateEngagementBalance(messages),
    communicationStyle: 'mixed', // direct/indirect, formal/casual
  };
  
  if (geminiSummary && geminiSummary.behavior_flags) {
    return {
      ...baseFeatures,
      behaviorFlags: geminiSummary.behavior_flags,
      personalityTraits: geminiSummary.personality_traits || [],
    };
  }
  
  return baseFeatures;
}

/**
 * Extract temporal features
 */
function extractTemporalFeatures(messages) {
  return {
    conversationDuration: 'unknown', // Would need timestamps
    messageFrequency: messages.length, // per hour would be better
    timeOfDay: new Date().getHours(), // Would extract from timestamps
    dayOfWeek: new Date().getDay(),
  };
}

// Helper functions

function calculateSentiment(text) {
  const positive = countWords(text, POSITIVE_WORDS);
  const negative = countWords(text, NEGATIVE_WORDS);
  const total = positive + negative;
  
  if (total === 0) return 0.5; // Neutral
  return positive / total; // 0-1 scale, 0.5 = neutral
}

function calculateEmotionalIntensity(text) {
  const exclamations = (text.match(/!/g) || []).length;
  const caps = (text.match(/[A-Z]{3,}/g) || []).length;
  const emojis = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  
  return Math.min((exclamations + caps + emojis) / Math.max(text.split(/\s+/).length, 1), 1);
}

function countWords(text, wordList) {
  const lowerText = text.toLowerCase();
  return wordList.filter(word => lowerText.includes(word)).length;
}

function calculateEngagementLevel(messages) {
  if (messages.length === 0) return 0;
  
  const avgLength = messages.reduce((sum, m) => sum + m.text.length, 0) / messages.length;
  const questionCount = messages.filter(m => m.text.includes('?')).length;
  const emojiCount = messages.reduce((sum, m) => sum + (m.text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length, 0);
  
  // Simple heuristic: longer messages + questions + emojis = higher engagement
  const score = (avgLength / 50) * 0.4 + (questionCount / messages.length) * 0.3 + (emojiCount / messages.length) * 0.3;
  return Math.min(score, 1);
}

function calculateEngagementBalance(messages) {
  // This is a simplified version - would need to identify different speakers
  // For now, return a placeholder
  return 0.5; // Balanced
}

// Word lists for sentiment analysis (simplified)
const POSITIVE_WORDS = ['happy', 'great', 'love', 'amazing', 'wonderful', 'excited', 'good', 'nice', 'awesome', 'fantastic'];
const NEGATIVE_WORDS = ['sad', 'bad', 'hate', 'terrible', 'awful', 'angry', 'frustrated', 'disappointed', 'upset', 'worried'];
const NEUTRAL_WORDS = ['ok', 'sure', 'maybe', 'perhaps', 'probably', 'possibly'];

