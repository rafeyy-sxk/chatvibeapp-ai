"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, CheckCircle, AlertCircle, Zap } from "lucide-react";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX) {
        height = Math.round((height * MAX) / width);
        width = MAX;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function UploadAreaV2({ onResult, accessToken, customPrompt = "" }) {
  const [stage, setStage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState("");
  const [error, setError] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);

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

      setUploadedFiles(
        acceptedFiles.map((f) => ({
          id: `${f.name}-${Date.now()}-${Math.random()}`,
          name: f.name,
          size: f.size,
          preview: URL.createObjectURL(f),
        }))
      );

      try {
        setStage("compressing");
        setStatusLabel("Preparing images…");
        setProgress(10);

        const dataUrls = await Promise.all(acceptedFiles.map((f) => compressImage(f)));
        setProgress(30);

        setStage("analysing");
        setStatusLabel("Analysing with AI…");
        setProgress(40);

        const payload = { images: dataUrls };
        if (customPrompt?.trim()) payload.customPrompt = customPrompt.trim();

        const progressTimer = setInterval(() => {
          setProgress((p) => (p < 85 ? p + 3 : p));
        }, 400);

        const res = await fetch("/api/analyze-vision", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        clearInterval(progressTimer);
        setProgress(90);

        const data = await res.json();

        if (!res.ok) {
          const errObj = data.error;
          const msg = typeof errObj === "object" && errObj?.message
            ? errObj.message
            : typeof errObj === "string" ? errObj : "Analysis failed.";
          throw new Error(msg);
        }

        setStage("done");
        setStatusLabel("Complete!");
        setProgress(100);

        await new Promise((r) => setTimeout(r, 600));

        setUploadedFiles([]);
        setStage(null);
        setProgress(0);
        setStatusLabel("");

        if (typeof onResult === "function") {
          onResult({ reportId: data.reportId, analysis: data.analysis });
        }
      } catch (err) {
        console.error("[UploadArea]", err);
        setError(err.message || "Analysis failed. Please try again.");
        setUploadedFiles([]);
        setStage(null);
        setProgress(0);
        setStatusLabel("");
      }
    },
    [accessToken, customPrompt, onResult]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".heic", ".heif", ".bmp"] },
    maxFiles: 10,
    disabled: isLoading,
  });

  return (
    <div className="w-full space-y-4">
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
            {stage !== "done" ? (
              <>
                <div className="w-10 h-10 border-2 border-violet-500/25 border-t-violet-400 rounded-full animate-spin-smooth" />
                <div className="w-full max-w-xs space-y-2.5 text-center">
                  <p className="text-sm font-medium text-white/70">{statusLabel}</p>
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
                {isDragActive ? "Drop your screenshots here" : "Drag & drop screenshots, or click to browse"}
              </p>
              <p className="mt-1 text-xs text-white/35 flex items-center justify-center gap-1">
                <Zap size={10} className="text-violet-400" />
                Any image (JPG, PNG, WebP, HEIC, AVIF, GIF) · Up to 10 files
              </p>
            </div>
          </div>
        )}
      </div>

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
    </div>
  );
}
