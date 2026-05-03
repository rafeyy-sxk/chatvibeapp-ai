"use client";

import { useCallback, useState, useMemo, memo } from "react";
import { useDropzone } from "react-dropzone";
import { compressImages, needsCompression } from "@/lib/utils/imageCompression";

/**
 * Optimized Upload Area Component
 * - Image compression before upload
 * - Streaming upload support
 * - Optimized re-renders with memo
 */
export const UploadAreaOptimized = memo(function UploadAreaOptimized({
  onResult,
  accessToken,
  customPrompt = "",
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const resolveToken = useCallback(() => {
    if (accessToken) return accessToken;
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("cv_access_token") || "";
  }, [accessToken]);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setError(null);
      setProgress(0);
      
      if (acceptedFiles.length === 0) return;
      if (acceptedFiles.length > 10) {
        setError("Maximum 10 images allowed");
        return;
      }

      const token = resolveToken();
      if (!token) {
        setError("You must be logged in before uploading conversations.");
        return;
      }

      setLoading(true);
      try {
        // Compress images before upload
        setProgress(10);
        const imagesBase64 = await compressImages(acceptedFiles, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
        });
        setProgress(30);

        const payload = { images: imagesBase64 };
        if (customPrompt?.trim()) {
          payload.customPrompt = customPrompt.trim();
        }

        setProgress(40);
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        setProgress(60);
        const data = await res.json();
        
        if (res.ok) {
          setProgress(100);
          if (typeof onResult === "function") {
            onResult(data);
          }
        } else {
          setError(data.error || "Failed to create analysis job.");
        }
      } catch (err) {
        console.error(err);
        setError("Upload failed. Please try again.");
      } finally {
        setLoading(false);
        setProgress(0);
      }
    },
    [accessToken, customPrompt, onResult, resolveToken]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpeg", ".jpg", ".webp"] },
    maxFiles: 10,
  });

  const loadingText = useMemo(() => {
    if (progress < 30) return "Compressing images...";
    if (progress < 60) return "Uploading...";
    if (progress < 100) return "Creating job...";
    return "Processing...";
  }, [progress]);

  return (
    <div
      {...getRootProps()}
      className={`w-full max-w-3xl p-10 border-4 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
        isDragActive
          ? "border-indigo-400 bg-indigo-500/10 scale-105"
          : "border-white/20 hover:border-white/40 hover:scale-105"
      }`}
    >
      <input {...getInputProps()} />
      {loading ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-lg font-semibold text-white/80">{loadingText}</p>
          {progress > 0 && (
            <div className="w-full max-w-xs">
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-sm text-white/50 mt-1">{progress}%</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="mt-2 text-lg font-semibold text-white">
            {isDragActive ? "Drop your screenshots!" : "Drag & drop chat screenshots here"}
          </p>
          <p className="text-sm text-white/60">or click to select up to 10 files</p>
          {error && (
            <p className="mt-4 text-sm font-semibold text-red-200 bg-red-500/20 px-4 py-3 rounded-lg">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

