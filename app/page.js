"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Shield, Zap, Brain, MessageSquare } from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "AI-Powered Insights",
    desc: "Gemini 2.5 Flash decodes emotional tone, behavioral patterns, and relationship dynamics.",
  },
  {
    icon: Shield,
    title: "Privacy First",
    desc: "Images processed in-memory, never stored. PII is auto-detected and redacted before analysis.",
  },
  {
    icon: Zap,
    title: "Real-Time Analysis",
    desc: "Server-Sent Events stream live progress as your screenshots are OCR'd and analyzed.",
  },
  {
    icon: MessageSquare,
    title: "Multi-Platform",
    desc: "Works with WhatsApp, iMessage, Instagram DMs, Telegram — any chat screenshot.",
  },
];

const METRICS = [
  { label: "Flirty", color: "#f472b6" },
  { label: "Passive Aggressive", color: "#a78bfa" },
  { label: "Friendly", color: "#34d399" },
  { label: "Romantic", color: "#fb7185" },
  { label: "Dry Energy", color: "#60a5fa" },
  { label: "Confused", color: "#fbbf24" },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="mx-auto flex min-h-[85vh] max-w-5xl flex-col items-center justify-center gap-8 px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-6"
        >
          <span className="badge badge-purple">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Now with Gemini 2.5 Flash
          </span>

          <h1
            className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.75rem]"
            style={{ letterSpacing: "-0.025em" }}
          >
            Decode every conversation
            <br />
            <span className="gradient-text">before it's too late</span>
          </h1>

          <p className="max-w-xl text-base text-white/55 leading-relaxed sm:text-lg">
            Upload chat screenshots. ChatVibe AI runs OCR, runs psychological
            analysis via Gemini, and surfaces emotional patterns you might have
            missed.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/signup" className="btn-primary flex items-center gap-2 px-6 py-3 text-sm">
              Start for free
              <ArrowRight size={14} />
            </Link>
            <Link href="/upload" className="btn-secondary flex items-center gap-2 px-6 py-3 text-sm">
              Upload a screenshot
            </Link>
          </div>

          <p className="text-xs text-white/30">
            No credit card required · 10 free analyses per month
          </p>
        </motion.div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.07 }}
              className="glass-card-subtle p-5 group hover:border-white/14 transition-colors"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/10 border border-violet-500/15">
                <f.icon size={16} className="text-violet-400" />
              </div>
              <h3 className="mb-1.5 text-sm font-semibold text-white">
                {f.title}
              </h3>
              <p className="text-xs text-white/45 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Metrics preview */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="glass-card p-8 md:p-10"
        >
          <div className="mb-6 flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.2em] text-white/35 font-medium">
              Sample analysis output
            </span>
            <h2 className="text-xl font-semibold text-white">
              Emotional metrics at a glance
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {METRICS.map((m, i) => {
              const value = [72, 28, 85, 55, 40, 18][i];
              return (
                <div key={m.label} className="metric-card">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-white/55 uppercase tracking-wide">
                      {m.label}
                    </span>
                    <span className="text-sm font-bold" style={{ color: m.color }}>
                      {value}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <motion.div
                      className="progress-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${value}%` }}
                      transition={{ duration: 0.8, delay: 0.6 + i * 0.08 }}
                      style={{ background: `linear-gradient(90deg, ${m.color}80, ${m.color})` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-5 border-t border-white/6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Overall Vibe</p>
              <p className="text-xs text-white/45 mt-0.5">
                Flirtatious with hints of romantic tension and genuine warmth
              </p>
            </div>
            <Link href="/upload" className="btn-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
              Analyze your chat <ArrowRight size={12} />
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
