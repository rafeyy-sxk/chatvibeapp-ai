const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 8000;

function groqKey() {
  const key = (process.env.GROQ_API_KEY || "").replace(/^﻿/, "").trim();
  if (!key) throw new Error("GROQ_API_KEY is not configured");
  return key;
}

function buildMessages(prompt, image, system) {
  const msgs = [];
  if (system) msgs.push({ role: "system", content: system });

  if (image) {
    const { mimeType, base64 } = image;
    const url = base64.startsWith("data:") ? base64 : `data:${mimeType};base64,${base64}`;
    msgs.push({
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url } },
      ],
    });
  } else {
    msgs.push({ role: "user", content: prompt });
  }

  return msgs;
}

function groqBody(messages, stream, { temperature = 0.3, maxTokens = 1024, responseFormat } = {}) {
  const body = {
    model: GROQ_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream,
  };
  if (responseFormat) body.response_format = responseFormat;
  return body;
}

/**
 * @param {{ prompt?: string, image?: { mimeType: string, base64: string },
 *           system?: string, messages?: object[], temperature?: number,
 *           maxTokens?: number, responseFormat?: object }} opts
 * @returns {Promise<string>}
 */
export async function generate({ prompt = "", image, system, messages, temperature, maxTokens, responseFormat } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const msgs = messages ?? buildMessages(prompt, image, system);
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey()}` },
      body: JSON.stringify(groqBody(msgs, false, { temperature, maxTokens, responseFormat })),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Groq ${res.status}: ${err?.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Async generator — yields tokens as they stream from Groq.
 * @param {{ prompt?: string, image?: { mimeType: string, base64: string },
 *           system?: string, messages?: object[], temperature?: number,
 *           maxTokens?: number }} opts
 * @yields {string}
 */
export async function* generateStream({ prompt = "", image, system, messages, temperature, maxTokens } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const msgs = messages ?? buildMessages(prompt, image, system);
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey()}` },
      body: JSON.stringify(groqBody(msgs, true, { temperature, maxTokens })),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Groq ${res.status}: ${err?.error?.message || res.statusText}`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop(); // keep last (possibly incomplete) line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const chunk = JSON.parse(payload);
            const token = chunk.choices?.[0]?.delta?.content;
            if (token) yield token;
          } catch {
            // skip malformed SSE chunks
          }
        }
      }
    } finally {
      reader.cancel().catch(() => null);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} text
 * @returns {string}
 */
export function vibePrompt(text) {
  return `In 2-3 sentences, describe only the vibe, mood, or atmosphere of this content. Be evocative, not analytical. Don't summarize facts.\n\nContent:\n${text}`;
}

/**
 * @returns {Promise<boolean>}
 */
export async function healthCheck() {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${groqKey()}` },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
