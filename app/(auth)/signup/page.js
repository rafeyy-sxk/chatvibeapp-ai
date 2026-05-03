"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Eye, EyeOff, Zap, Check } from "lucide-react";

export default function SignupPage() {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetch("/api/health").catch(() => {});
  }, []);

  const getCsrfToken = () => {
    if (typeof document === "undefined") return "";
    const match = document.cookie.match(/cv_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const csrfToken = getCsrfToken();
      const headers = { "Content-Type": "application/json" };
      if (csrfToken) headers["x-csrf-token"] = csrfToken;
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers,
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to sign up. Please try again.");
        return;
      }
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cv_access_token", data.accessToken);
        sessionStorage.setItem("cv_user", JSON.stringify(data.user));
      }
      window.location.href = "/upload";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const pwStrong = form.password.length >= 8;

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
              Create your account
            </h1>
            <p className="mt-1.5 text-sm text-white/45">
              10 free analyses per month, no card required
            </p>
          </div>
        </div>

        <div className="glass-card p-7">
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Signup form">
            <div className="space-y-1.5">
              <label htmlFor="signup-username" className="block text-xs font-medium uppercase tracking-wide text-white/45">
                Username
              </label>
              <input
                id="signup-username"
                required
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                aria-required="true"
                className="input-field"
                placeholder="yourname"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-email" className="block text-xs font-medium uppercase tracking-wide text-white/45">
                Email{" "}
                <span className="normal-case text-white/25 font-normal">(optional)</span>
              </label>
              <input
                id="signup-email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                className="input-field"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="block text-xs font-medium uppercase tracking-wide text-white/45">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  required
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  aria-required="true"
                  className="input-field pr-10"
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className={`flex items-center gap-1.5 text-xs transition-colors ${pwStrong ? "text-emerald-400" : "text-white/35"}`}>
                  <Check size={11} strokeWidth={2.5} />
                  {pwStrong ? "Strong password" : "At least 8 characters"}
                </div>
              )}
            </div>

            {error && (
              <motion.div
                role="alert"
                aria-live="assertive"
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
              className="btn-primary w-full py-2.5 text-sm mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-smooth" />
                  Creating account…
                </span>
              ) : (
                "Create account"
              )}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-white/40">
          Already have an account?{" "}
          <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
