"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle, AlertCircle, Clock, Cpu } from "lucide-react";

const STATUS_CONFIG = {
  QUEUED: { label: "Queued", icon: Clock, color: "text-white/50" },
  PROCESSING: { label: "Processing images…", icon: Cpu, color: "text-violet-300" },
  OCR_IN_PROGRESS: { label: "Running OCR…", icon: Cpu, color: "text-violet-300" },
  ANALYSIS_IN_PROGRESS: { label: "Analysing with Gemini…", icon: Cpu, color: "text-fuchsia-300" },
  COMPLETED: { label: "Analysis complete!", icon: CheckCircle, color: "text-emerald-400" },
  FAILED: { label: "Analysis failed", icon: AlertCircle, color: "text-red-400" },
  CANCELLED: { label: "Cancelled", icon: AlertCircle, color: "text-white/40" },
};

export function JobStatusStream({ jobId, onComplete, onError }) {
  const [status, setStatus] = useState("QUEUED");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [reportId, setReportId] = useState(null);
  const pollIntervalRef = useRef(null);
  const router = useRouter();

  const pollStatus = useCallback(async () => {
    if (!jobId) return;

    try {
      const token = sessionStorage.getItem("cv_access_token");
      if (!token) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch(`/api/jobs/${jobId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setStatus(data.status);
      setProgress(data.progress || 0);

      if (data.errorMessage) setError(data.errorMessage);

      if (data.status === "COMPLETED") {
        clearInterval(pollIntervalRef.current);
        const resolvedReportId = data.reportId || jobId;
        setReportId(resolvedReportId);
        setTimeout(() => {
          if (onComplete) {
            onComplete({ reportId: resolvedReportId });
          } else {
            router.push(`/analysis/${resolvedReportId}`);
          }
        }, 1200);
      } else if (data.status === "FAILED" || data.status === "CANCELLED") {
        clearInterval(pollIntervalRef.current);
        if (onError) onError({ errorMessage: data.errorMessage });
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, [jobId, router, onComplete, onError]);

  useEffect(() => {
    if (!jobId) return;
    pollStatus();
    pollIntervalRef.current = setInterval(pollStatus, 2500);
    return () => clearInterval(pollIntervalRef.current);
  }, [jobId, pollStatus]);

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.QUEUED;
  const isActive = !["COMPLETED", "FAILED", "CANCELLED"].includes(status);
  const isFailed = status === "FAILED" || status === "CANCELLED";

  return (
    <div className="w-full space-y-4">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {isActive ? (
            <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin-smooth" />
          ) : (
            <cfg.icon size={16} className={cfg.color} />
          )}
          <span className={`text-sm font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
        <span className="text-xs text-white/35 font-mono tabular-nums">
          {progress}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <motion.div
          className="progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Stage labels */}
      <div className="flex items-center justify-between text-[10px] text-white/25 font-medium uppercase tracking-wide">
        <span className={progress >= 5 ? "text-white/50" : ""}>Upload</span>
        <span className={progress >= 40 ? "text-white/50" : ""}>OCR</span>
        <span className={progress >= 55 ? "text-white/50" : ""}>Analytics</span>
        <span className={progress >= 60 ? "text-white/50" : ""}>Gemini</span>
        <span className={progress >= 100 ? "text-emerald-400" : ""}>Done</span>
      </div>

      {/* Error */}
      {error && isFailed && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-3.5 py-3 text-xs text-red-300"
        >
          <AlertCircle size={12} className="mt-0.5 shrink-0 text-red-400" />
          {error}
        </motion.div>
      )}

      {/* Success */}
      {status === "COMPLETED" && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3.5 py-3 text-xs text-emerald-300"
        >
          <CheckCircle size={12} className="shrink-0" />
          Analysis ready. Loading results…
        </motion.div>
      )}

      <p className="text-center text-[10px] text-white/25">
        Job ID: {jobId?.substring(0, 12)}…
      </p>
    </div>
  );
}
