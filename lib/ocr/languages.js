/**
 * Multi-language OCR configuration for Tesseract.js.
 * Feature #12 — supports English, Arabic, Urdu, Spanish, French, German.
 *
 * Usage:
 *   const { lang } = SUPPORTED_LANGUAGES.find(l => l.code === "ara");
 *   await Tesseract.recognize(image, lang);
 *
 * Traineddata files are loaded from Tesseract.js CDN by default.
 * For offline use, download from: https://github.com/naptha/tessdata/tree/gh-pages/4.0.0
 * and serve from /public/tessdata/
 */

export const SUPPORTED_LANGUAGES = [
  {
    code: "eng",
    lang: "eng",
    label: "English",
    nativeLabel: "English",
    rtl: false,
    script: "Latin",
    accuracy: "high",
  },
  {
    code: "ara",
    lang: "ara",
    label: "Arabic",
    nativeLabel: "العربية",
    rtl: true,
    script: "Arabic",
    accuracy: "high",
    notes: "Right-to-left. Works with Modern Standard Arabic and most dialects.",
  },
  {
    code: "urd",
    lang: "urd",
    label: "Urdu",
    nativeLabel: "اردو",
    rtl: true,
    script: "Nastaliq",
    accuracy: "medium",
    notes: "Nastaliq script. Accuracy varies with image quality.",
  },
  {
    code: "spa",
    lang: "spa",
    label: "Spanish",
    nativeLabel: "Español",
    rtl: false,
    script: "Latin",
    accuracy: "high",
  },
  {
    code: "fra",
    lang: "fra",
    label: "French",
    nativeLabel: "Français",
    rtl: false,
    script: "Latin",
    accuracy: "high",
  },
  {
    code: "deu",
    lang: "deu",
    label: "German",
    nativeLabel: "Deutsch",
    rtl: false,
    script: "Latin",
    accuracy: "high",
  },
  {
    code: "chi_sim",
    lang: "chi_sim",
    label: "Chinese (Simplified)",
    nativeLabel: "中文（简体）",
    rtl: false,
    script: "Han",
    accuracy: "medium",
    notes: "Requires chi_sim.traineddata (~20MB). Download separately.",
  },
];

/** Map from ISO code to Tesseract language string */
export const LANGUAGE_MAP = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l.lang])
);

/** Get Tesseract lang string for a code, default to English */
export function getTesseractLang(code) {
  return LANGUAGE_MAP[code] || "eng";
}

/** Languages that require RTL text direction */
export const RTL_CODES = new Set(
  SUPPORTED_LANGUAGES.filter((l) => l.rtl).map((l) => l.code)
);

export function isRTL(code) {
  return RTL_CODES.has(code);
}
