"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const getCsrfToken = () => {
    if (typeof document === "undefined") return "";
    const match = document.cookie.match(/cv_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const csrfToken = getCsrfToken();
      const headers = { "Content-Type": "application/json" };
      if (csrfToken) headers["x-csrf-token"] = csrfToken;
      await fetch("/api/auth/reset-request", {
        method: "POST",
        headers,
        body: JSON.stringify({ usernameOrEmail: email }),
      });
      setSent(true);
      setMessage("If that email exists, we've sent a reset link. Check your inbox.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center px-5 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full"
      >
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-xl shadow-violet-500/30">
            <Zap size={20} className="text-white" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Forgot your password?
            </h1>
            <p className="mt-1.5 text-sm text-white/45">
              Enter your email and we'll send a reset link.
            </p>
          </div>
        </div>

        <div className="glass-card p-7">
          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-4 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25">
                <Mail size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Check your inbox</p>
                <p className="mt-1.5 text-sm text-white/45 leading-relaxed">{message}</p>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" aria-label="Forgot password form">
              <div className="space-y-1.5">
                <label htmlFor="forgot-email" className="block text-xs font-medium uppercase tracking-wide text-white/45">
                  Email address
                </label>
                <input
                  id="forgot-email"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  autoComplete="email"
                  className="input-field"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="badge badge-red w-full justify-center py-2.5 rounded-xl text-sm"
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="btn-primary w-full py-2.5 text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-smooth" />
                    Sending link…
                  </span>
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-white/40">
          <Link href="/login" className="flex items-center justify-center gap-1.5 text-violet-400 hover:text-violet-300 transition-colors font-medium">
            <ArrowLeft size={12} /> Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
