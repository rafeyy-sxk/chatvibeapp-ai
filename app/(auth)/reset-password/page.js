"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { Eye, EyeOff, Zap, Check, ArrowLeft } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getCsrfToken = () => {
    if (typeof document === "undefined") return "";
    const match = document.cookie.match(/cv_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!token) { setError("Reset link is missing or invalid."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const csrfToken = getCsrfToken();
      const headers = { "Content-Type": "application/json" };
      if (csrfToken) headers["x-csrf-token"] = csrfToken;
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers,
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to reset password. Your link may have expired.");
        return;
      }
      setMessage("Password updated! Redirecting to login…");
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const pwStrong = password.length >= 8;
  const pwMatch = confirm.length > 0 && password === confirm;

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
              Create new password
            </h1>
            <p className="mt-1.5 text-sm text-white/45">
              Choose a strong password you haven't used before.
            </p>
          </div>
        </div>

        <div className="glass-card p-7">
          {!token ? (
            <div className="flex flex-col items-center gap-4 py-3 text-center">
              <p className="text-sm text-red-300">Reset link is missing or invalid.</p>
              <Link href="/forgot-password" className="btn-primary text-sm px-5 py-2">
                Request a new link
              </Link>
            </div>
          ) : message ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-4 text-center"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25">
                <Check size={18} className="text-emerald-400" strokeWidth={2.5} />
              </div>
              <p className="text-sm text-emerald-300 font-medium">{message}</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="reset-password" className="block text-xs font-medium uppercase tracking-wide text-white/45">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="reset-password"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    autoComplete="new-password"
                    className="input-field pr-10"
                    placeholder="Min 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65 transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <p className={`text-xs flex items-center gap-1 ${pwStrong ? "text-emerald-400" : "text-white/35"}`}>
                    <Check size={10} strokeWidth={2.5} />
                    {pwStrong ? "Strong password" : "At least 8 characters"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reset-confirm" className="block text-xs font-medium uppercase tracking-wide text-white/45">
                  Confirm password
                </label>
                <input
                  id="reset-confirm"
                  required
                  type="password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  autoComplete="new-password"
                  className="input-field"
                  placeholder="Repeat password"
                />
                {confirm.length > 0 && (
                  <p className={`text-xs flex items-center gap-1 ${pwMatch ? "text-emerald-400" : "text-red-400/70"}`}>
                    <Check size={10} strokeWidth={2.5} />
                    {pwMatch ? "Passwords match" : "Passwords don't match"}
                  </p>
                )}
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
                className="btn-primary w-full py-2.5 text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-smooth" />
                    Updating password…
                  </span>
                ) : (
                  "Reset password"
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center">
          <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors font-medium">
            <ArrowLeft size={12} /> Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center px-5 py-16">
        <div className="glass-card p-7 w-full text-center text-white/40 text-sm">Loading…</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
