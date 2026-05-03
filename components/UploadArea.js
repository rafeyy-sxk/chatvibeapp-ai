"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = (error) => reject(error);
  });

export function UploadArea({ onResult, accessToken, customPrompt = "" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState([]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Process offline queue when back online
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      processOfflineQueue();
    }
  }, [isOnline, offlineQueue]);

  const processOfflineQueue = async () => {
    for (const item of offlineQueue) {
      try {
        await submitAnalysis(item.images, item.customPrompt);
      } catch (error) {
        console.error('Failed to process offline analysis:', error);
      }
    }
    setOfflineQueue([]);
  };

  const resolveToken = () => {
    if (accessToken) return accessToken;
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("cv_access_token") || "";
  };

  const submitAnalysis = async (imagesBase64, prompt) => {
    const token = resolveToken();
    const payload = { images: imagesBase64 };
    if (prompt?.trim()) {
      payload.customPrompt = prompt.trim();
    }

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok) {
      if (typeof onResult === "function") {
        onResult(data);
      }
    } else {
      setError(data.error || "Failed to analyze conversation.");
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setError(null);
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
        const imagesBase64 = await Promise.all(acceptedFiles.map(toBase64));

        if (!isOnline) {
          // Queue for offline processing
          setOfflineQueue(prev => [...prev, { images: imagesBase64, customPrompt }]);
          setError("You're offline. Analysis will be processed when connection is restored.");
          setLoading(false);
          return;
        }

        await submitAnalysis(imagesBase64, customPrompt);
      } catch (err) {
        console.error(err);
        setError("Analysis failed. Please try again.");
      } finally {
        if (Array.isArray(acceptedFiles)) {
          acceptedFiles.length = 0;
        }
        setLoading(false);
      }
    },
    [accessToken, customPrompt, onResult, isOnline],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpeg", ".jpg", ".webp"] },
    maxFiles: 10,
  });

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
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-lg font-semibold text-white/80">Analyzing your vibe…</p>
          <p className="text-sm text-white/50">This may take a moment for multiple screenshots.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <p className="text-xs text-white/60">
              {isOnline ? 'Online' : 'Offline - Queued analyses will process when connected'}
            </p>
          </div>
          {offlineQueue.length > 0 && (
            <p className="text-xs text-yellow-400 mb-4">
              {offlineQueue.length} analysis{offlineQueue.length > 1 ? 'es' : ''} queued for processing
            </p>
          )}
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
}
