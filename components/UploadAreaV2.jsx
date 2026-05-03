"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UpgradeModal } from "./UpgradeModal";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";

const STAGES = [
  { key: "reading", label: "Reading images…", pct: 15 },
  { key: "ocr", label: "Extracting text (OCR)…", pct: 55 },
  { key: "analysing", label: "Analysing with Groq AI…", pct: 85 },
  { key: "saving", label: "Saving report…", pct: 95 },
  { key: "done", label: "Analysis complete!", pct: 100 },
];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

async function runOCR(dataUrl) {
  // Dynamically import Tesseract.js to avoid SSR issues
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: () => {}, // suppress Tesseract logs
  });
  try {
    const { data: { text } } = await worker.recognize(dataUrl);
    return text?.trim() || "";
  } finally {
    await worker.terminate();
  }
}

export function UploadAreaV2({ onResult, accessToken, customPrompt = "" }) {
  const [stage, setStage] = useState(null); // null = idle
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [currentTier, setCurrentTier] = useState("FREE");

  const isLoading = stage !== null && stage !== "done";

  const resolveToken = () => {
    if (accessToken) return accessToken;
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("cv_access_token") || "";
  };

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setError(null);
      if (!acceptedFiles.length) return;
      if (acceptedFiles.length > 10) {
        setError("Maximum 10 images allowed.");
        return;
      }

      const token = resolveToken();
      if (!token) {
        setError("You must be signed in to analyse conversations.");
        return;
      }

      // Show previews immediately
      const previews = acceptedFiles.map((f) => ({
        id: `${f.name}-${Date.now()}-${Math.random()}`,
        name: f.name,
        size: f.size,
        preview: URL.createObjectURL(f),
      }));
      setUploadedFiles(previews);

      try {
        // Stage 1: Read files as data URLs
        setStage("reading");
        setProgress(5);
        const dataUrls = await Promise.all(
          acceptedFiles.map(
            (file) =>
              new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              })
          )
        );
        setProgress(15);

        // Stage 2: OCR each image in sequence (shows progress per image)
        setStage("ocr");
        const texts = [];
        for (let i = 0; i < dataUrls.length; i++) {
          const text = await runOCR(dataUrls[i]);
          texts.push(text);
          setProgress(15 + Math.round(((i + 1) / dataUrls.length) * 40));
        }

        const combinedText = texts.filter(Boolean).join("\n\n---\n\n");

        if (!combinedText.trim()) {
          throw new Error(
            "No text could be extracted. Please use clear, readable screenshots."
          );
        }

        // Stage 3: Send to Groq analysis API
        setStage("analysing");
        setProgress(60);

        const payload = { text: combinedText };
        if (customPrompt?.trim()) payload.customPrompt = customPrompt.trim();

        const res = await fetch("/api/analyze-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        setProgress(90);

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 402 || data.reason === "INSUFFICIENT_CREDITS") {
            setError(data.message || "You've run out of credits.");
            setShowUpgradeModal(true);
            try {
              const usageRes = await fetch("/api/billing/usage", {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (usageRes.ok) {
                const ud = await usageRes.json();
                setCurrentTier(ud.tier || "FREE");
              }
            } catch { /* ignore */ }
          } else {
            throw new Error(data.error || data.message || "Analysis failed.");
          }
          setUploadedFiles([]);
          setStage(null);
          setProgress(0);
          return;
        }

        // Stage 4: Done
        setStage("saving");
        setProgress(95);

        await new Promise((r) => setTimeout(r, 300)); // brief "saving" flash

        setStage("done");
        setProgress(100);

        await new Promise((r) => setTimeout(r, 600)); // show success briefly

        setUploadedFiles([]);
        setStage(null);
        setProgress(0);

        if (typeof onResult === "function") {
          onResult({ reportId: data.reportId, analysis: data.analysis });
        }
      } catch (err) {
        console.error("[UploadArea]", err);
        setError(err.message || "Analysis failed. Please try again.");
        setUploadedFiles([]);
        setStage(null);
        setProgress(0);
      }
    },
    [accessToken, customPrompt, onResult]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpeg", ".jpg", ".webp"] },
    maxFiles: 10,
    disabled: isLoading,
  });

  const currentStage = STAGES.find((s) => s.key === stage);

  return (
    <div className="w-full space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        role="button"
        tabIndex={0}
        aria-label="Upload chat screenshots"
        aria-disabled={isLoading}
        className={`relative w-full rounded-2xl border-2 border-dashed transition-all duration-200 ${
          isDragActive
            ? "border-violet-500/70 bg-violet-500/8 scale-[1.01]"
            : isLoading
            ? "border-white/8 cursor-not-allowed bg-white/2"
            : "border-white/12 hover:border-white/28 hover:bg-white/2 cursor-pointer"
        }`}
      >
        <input {...getInputProps()} />

        {isLoading || stage === "done" ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-10">
            {/* Progress */}
            {stage !== "done" ? (
              <>
                <div className="w-10 h-10 border-2 border-violet-500/25 border-t-violet-400 rounded-full animate-spin-smooth" />
                <div className="w-full max-w-xs space-y-2 text-center">
                  <p className="text-sm font-medium text-white/70">
                    {currentStage?.label || "Processing…"}
                  </p>
                  <div className="progress-bar">
                    <motion.div
                      className="progress-fill"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-xs text-white/30 tabular-nums">{progress}%</p>
                </div>
              </>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-2"
              >
                <CheckCircle size={28} className="text-emerald-400" />
                <p className="text-sm font-medium text-emerald-300">Analysis complete!</p>
              </motion.div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
                isDragActive ? "bg-violet-500/20 text-violet-300" : "bg-white/5 text-white/35"
              }`}
            >
              <Upload size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-white/80">
                {isDragActive
                  ? "Drop your screenshots here"
                  : "Drag & drop screenshots, or click to browse"}
              </p>
              <p className="mt-0.5 text-xs text-white/35">
                PNG, JPG, WEBP · Up to 10 files · OCR runs in your browser
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            role="alert"
            aria-live="assertive"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400/60 hover:text-red-400 transition-colors shrink-0"
            >
              <X size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File previews */}
      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5"
          >
            {uploadedFiles.map((file) => (
              <motion.div
                key={file.id}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="group relative aspect-square overflow-hidden rounded-xl border border-white/8"
              >
                <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                  <p className="text-[10px] text-white truncate font-medium">{file.name}</p>
                  <p className="text-[10px] text-white/50">{formatBytes(file.size)}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={currentTier}
        accessToken={resolveToken()}
      />
    </div>
  );
}
