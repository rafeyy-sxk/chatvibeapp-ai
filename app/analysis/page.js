"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Sparkles, Activity, User, Flag, MessageSquare } from "lucide-react";

const METRIC_COLORS = {
  flirty: "#f472b6",
  passive_aggressive: "#a78bfa",
  friendly: "#34d399",
  romantic: "#fb7185",
  dry_energy: "#60a5fa",
  angry: "#f87171",
  confused: "#fbbf24",
};

function MetricBar({ label, value }) {
  const color = METRIC_COLORS[label] || "#a78bfa";
  return (
    <div className="metric-card">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wide truncate">
          {label.replace(/_/g, " ")}
        </span>
        <span className="text-sm font-bold tabular-nums shrink-0" style={{ color }}>
          {value}%
        </span>
      </div>
      <div className="progress-bar">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, value)}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: `linear-gradient(90deg, ${color}60, ${color})` }}
        />
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState(null);
  const [ocrResults, setOcrResults] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const lastId = sessionStorage.getItem("cv_last_report_id");
    if (lastId) {
      router.replace(`/analysis/${lastId}`);
      return;
    }
    const raw = sessionStorage.getItem("cv_last_analysis");
    if (!raw) {
      setError("No analysis found. Upload screenshots to get started.");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setAnalysis(parsed.analysis);
      setOcrResults(parsed.ocrResults || []);
    } catch {
      setError("Unable to load the previous analysis.");
    }
  }, [router]);

  const clearAnalysis = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("cv_last_analysis");
      sessionStorage.removeItem("cv_last_report_id");
    }
    setAnalysis(null);
    setOcrResults([]);
    setError("Analysis cleared.");
  };

  return (
    <div className="page-container">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/35 font-medium mb-1">
              Results
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Analysis
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearAnalysis}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <RotateCcw size={11} />
              Clear
            </button>
            <Link href="/upload" className="btn-primary text-xs flex items-center gap-1.5">
              <ArrowLeft size={11} />
              New upload
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3.5 text-sm text-amber-200/80"
          >
            <span>{error}</span>
            <Link href="/upload" className="text-xs text-amber-300 font-medium underline underline-offset-2 ml-3">
              Upload now
            </Link>
          </div>
        )}

        {analysis && (
          <div className="space-y-5">
            {/* Overall vibe */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-card p-6 md:p-7"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-violet-500/15">
                  <Sparkles size={14} className="text-violet-300" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/35 font-medium">
                    Overall vibe
                  </p>
                  <h2 className="mt-0.5 text-xl font-bold text-white leading-tight">
                    {analysis.overall_vibe}
                  </h2>
                </div>
              </div>
              <p className="text-sm text-white/55 leading-relaxed">{analysis.summary}</p>
            </motion.div>

            {/* Emotional metrics */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-5 md:p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Activity size={14} className="text-violet-400" />
                <p className="text-xs uppercase tracking-[0.2em] text-white/40 font-medium">
                  Emotional metrics
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(analysis.metrics || {}).map(([key, value]) => (
                  <MetricBar key={key} label={key} value={value} />
                ))}
              </div>
            </motion.div>

            {/* Traits & Flags */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <User size={13} className="text-violet-400" />
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40 font-medium">
                    Personality traits
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(analysis.personality_traits || []).length > 0 ? (
                    analysis.personality_traits.map((trait) => (
                      <span key={trait} className="badge badge-purple">
                        {trait}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-white/35">No traits detected.</p>
                  )}
                </div>
              </div>

              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Flag size={13} className="text-amber-400" />
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40 font-medium">
                    Behavioral flags
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(analysis.behavior_flags || []).length > 0 ? (
                    analysis.behavior_flags.map((flag) => (
                      <span key={flag} className="badge badge-amber">
                        {flag}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-white/35">No flags detected.</p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Advice */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-5 md:p-6"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/70 font-medium mb-2">
                Advice
              </p>
              <p className="text-sm text-emerald-100/80 leading-relaxed">
                {analysis.advice}
              </p>
            </motion.div>

            {/* OCR Transcripts */}
            {ocrResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="glass-card p-5 md:p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={13} className="text-white/40" />
                  <p className="text-xs uppercase tracking-[0.2em] text-white/35 font-medium">
                    OCR transcripts
                  </p>
                </div>
                <ol className="space-y-3">
                  {ocrResults.map((text, index) => (
                    <li key={index} className="rounded-xl border border-white/6 bg-black/30 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-medium mb-2">
                        Image {index + 1}
                      </p>
                      <pre className="text-xs text-white/60 whitespace-pre-wrap font-sans leading-relaxed">
                        {text}
                      </pre>
                    </li>
                  ))}
                </ol>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
