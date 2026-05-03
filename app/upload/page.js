"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UploadAreaV2 } from "@/components/UploadAreaV2";
import { Shield, Image, Lightbulb, AlertCircle } from "lucide-react";

export default function UploadPage() {
  const router = useRouter();
  const [customPrompt, setCustomPrompt] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/health").catch(() => {});
    if (typeof window !== "undefined") {
      setAccessToken(sessionStorage.getItem("cv_access_token") || "");
    }
  }, []);

  const handleResult = (payload) => {
    if (typeof window !== "undefined" && payload?.reportId) {
      sessionStorage.setItem("cv_last_report_id", payload.reportId);
    }
    setStatus("Analysis complete. Redirecting…");
    if (payload?.reportId) {
      router.push(`/analysis/${payload.reportId}`);
    } else {
      router.push("/analysis");
    }
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
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/35 font-medium mb-1">
              Input
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Upload conversations
            </h1>
            <p className="mt-1 text-sm text-white/45">
              Drag screenshots, add an optional prompt, and let Gemini decode the dynamic.
            </p>
          </div>
          <Link
            href="/analysis"
            className="btn-secondary text-xs self-start sm:self-auto whitespace-nowrap"
          >
            View latest →
          </Link>
        </div>

        {/* Auth warning */}
        {!accessToken && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3.5 text-sm text-amber-200/80"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-400" />
            <span>
              You're not signed in.{" "}
              <Link href="/login" className="font-medium text-amber-300 underline underline-offset-3">
                Login
              </Link>{" "}
              to run analyses.
            </span>
          </motion.div>
        )}

        {/* Main card */}
        <div className="glass-card p-6 md:p-8 space-y-6">
          {/* Custom prompt */}
          <div className="space-y-2">
            <label
              htmlFor="custom-prompt"
              className="block text-xs font-medium uppercase tracking-[0.15em] text-white/40"
            >
              Custom prompt{" "}
              <span className="normal-case font-normal text-white/25">(optional)</span>
            </label>
            <textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={2}
              placeholder="e.g. Focus on passive aggression and avoidant patterns…"
              className="input-field resize-none text-sm"
            />
          </div>

          {/* Upload area */}
          <UploadAreaV2
            onResult={handleResult}
            accessToken={accessToken}
            customPrompt={customPrompt}
          />
        </div>

        {/* Info grid */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: Shield,
              title: "Privacy",
              desc: "Images processed in-memory, discarded immediately after analysis.",
            },
            {
              icon: Image,
              title: "Limits",
              desc: "Up to 10 screenshots per job. JPG, PNG, WEBP. Max 5 MB each.",
            },
            {
              icon: Lightbulb,
              title: "Tips",
              desc: "Clear, timestamped screenshots produce the most accurate analysis.",
            },
          ].map((item) => (
            <div key={item.title} className="glass-card-subtle p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <item.icon size={13} className="text-violet-400" />
                <span className="text-xs font-medium uppercase tracking-wide text-white/40">
                  {item.title}
                </span>
              </div>
              <p className="text-xs text-white/45 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Status */}
        {status && (
          <motion.p
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="badge badge-green w-full justify-center py-3 rounded-xl text-sm"
          >
            {status}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
