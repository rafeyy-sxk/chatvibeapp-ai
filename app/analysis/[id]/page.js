"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { exportAsJSON, exportAsCSV, exportAsPDF } from "@/lib/utils/export";
import { SkeletonDashboard } from "@/components/SkeletonLoader";
import {
  Sparkles, Activity, Flag, Tag, BarChart2, ArrowLeft,
  Download, AlertCircle, CheckCircle,
} from "lucide-react";

const METRIC_COLORS = {
  flirty: "#f472b6",
  passive_aggressive: "#a78bfa",
  friendly: "#34d399",
  romantic: "#fb7185",
  dry_energy: "#60a5fa",
  angry: "#f87171",
  confused: "#fbbf24",
};

const DOMINANCE_COLORS = ["#7c4dff", "#ec4899", "#34d399", "#f97316"];
const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#0e1018",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "#f0f2ff",
};

function Section({ title, icon: Icon, children, delay = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card p-5 md:p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={13} className="text-violet-400" />}
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
          {title}
        </p>
      </div>
      {children}
    </motion.section>
  );
}

export default function AnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (!id) return;
    const token = typeof window !== "undefined"
      ? sessionStorage.getItem("cv_access_token") || ""
      : "";
    if (!token) {
      setError("You must be signed in to view this report.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    async function loadReport() {
      try {
        const res = await fetch(`/api/reports/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to load report.");
          setLoading(false);
          return;
        }
        setReport(data);
        setLoading(false);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError("Unexpected error loading report.");
        setLoading(false);
      }
    }
    loadReport();
    return () => controller.abort();
  }, [id]);

  const sentimentData = useMemo(
    () => report?.analytics?.sentimentTimeline?.map((p) => ({ index: p.index, sentiment: p.sentiment })) || [],
    [report]
  );

  const toxicityData = useMemo(
    () => report?.analytics?.toxicity?.perMessage?.map((p) => ({ index: p.index, score: p.score })) || [],
    [report]
  );

  const dominanceEntries = useMemo(
    () => report?.analytics?.dominance?.speakers
      ? Object.entries(report.analytics.dominance.speakers).map(([name, value]) => ({ name, value }))
      : [],
    [report]
  );

  const keywordClusters = useMemo(() => report?.analytics?.keywordClusters || [], [report]);
  const behaviorFlags = useMemo(() => report?.analytics?.behaviorFlags || {}, [report]);
  const gemini = useMemo(() => report?.geminiSummary || null, [report]);

  const exportJSON = () => report && exportAsJSON(report, `chatvibe-${id}.json`);
  const exportCSV = () => report && exportAsCSV(report, `chatvibe-${id}.csv`);
  const exportPDF = async () => {
    if (!report) return;
    try { await exportAsPDF(report, `chatvibe-${id}.pdf`); }
    catch { alert("PDF export failed."); }
  };

  if (loading) {
    return (
      <div className="page-container">
        <SkeletonDashboard />
      </div>
    );
  }

  return (
    <div className="page-container">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-5"
      >
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/35 font-medium mb-1">
              Report
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Conversation analysis
            </h1>
            {report?.createdAt && (
              <p className="text-xs text-white/35 mt-0.5">
                {new Date(report.createdAt).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/3 p-1">
              {[["JSON", exportJSON], ["CSV", exportCSV], ["PDF", exportPDF]].map(([label, fn]) => (
                <button
                  key={label}
                  onClick={fn}
                  disabled={!report}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white/55 hover:text-white hover:bg-white/6 disabled:opacity-30 transition-colors"
                >
                  <Download size={10} />
                  {label}
                </button>
              ))}
            </div>
            <Link href="/upload" className="btn-primary text-xs flex items-center gap-1.5">
              <ArrowLeft size={11} />
              New upload
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3.5 text-sm text-red-200/80">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
            <span>
              {error}{" "}
              <Link href="/upload" className="underline underline-offset-2 text-red-300">
                Back to upload
              </Link>
            </span>
          </div>
        )}

        {!error && report && (
          <>
            {/* Gemini summary */}
            {gemini && (
              <Section title="AI summary" icon={Sparkles} delay={0.05}>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-white/35 mb-0.5">Overall vibe</p>
                    <h2 className="text-xl font-bold text-white">{gemini.overall_vibe}</h2>
                    <p className="mt-1.5 text-sm text-white/55 leading-relaxed">{gemini.summary}</p>
                  </div>

                  <div className="divider" />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-white/35 mb-2.5">
                        Emotional metrics
                      </p>
                      <div className="space-y-2.5">
                        {Object.entries(gemini.metrics || {}).map(([key, value]) => {
                          const color = METRIC_COLORS[key] || "#a78bfa";
                          return (
                            <div key={key}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-white/45 capitalize">{key.replace("_", " ")}</span>
                                <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}%</span>
                              </div>
                              <div className="progress-bar">
                                <motion.div
                                  className="h-full rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, value)}%` }}
                                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                                  style={{ background: `linear-gradient(90deg, ${color}50, ${color})` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-white/35 mb-2">
                          Personality traits
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(gemini.personality_traits || []).map((t) => (
                            <span key={t} className="badge badge-purple">{t}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-white/35 mb-2">
                          Behavior flags
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(gemini.behavior_flags || []).map((f) => (
                            <span key={f} className="badge badge-amber">{f}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {gemini.advice && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-4 py-3.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/60 mb-1">
                        Advice
                      </p>
                      <p className="text-sm text-emerald-100/75 leading-relaxed">{gemini.advice}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Vibe Box */}
            {report?.vibe && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  border: "1px solid rgba(201,123,79,0.2)",
                  borderRadius: "12px",
                  padding: "24px",
                  background: "rgba(201,123,79,0.03)",
                }}
              >
                <p
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "rgba(201,123,79,0.6)",
                    marginBottom: "0.75rem",
                  }}
                >
                  The Vibe
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-fraunces, 'Fraunces', Georgia, serif)",
                    fontStyle: "italic",
                    fontSize: "1rem",
                    color: "rgba(242,237,228,0.72)",
                    lineHeight: 1.75,
                  }}
                >
                  {report.vibe}
                </p>
              </motion.section>
            )}

            {/* Charts */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Section title="Sentiment timeline" icon={Activity} delay={0.1}>
                {sentimentData.length === 0 ? (
                  <p className="text-sm text-white/35">No sentiment data available.</p>
                ) : (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sentimentData}>
                        <XAxis dataKey="index" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10 }} />
                        <YAxis domain={[-1, 1]} stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [v, "Sentiment"]} />
                        <Line type="monotone" dataKey="sentiment" stroke="#7c4dff" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Section>

              <Section title="Toxicity spikes" icon={BarChart2} delay={0.12}>
                {toxicityData.length === 0 ? (
                  <p className="text-sm text-white/35">No toxicity indicators detected.</p>
                ) : (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={toxicityData}>
                        <XAxis dataKey="index" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 1]} stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [v, "Toxicity"]} />
                        <Bar dataKey="score" fill="#f87171" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Section>
            </div>

            {/* Dominance + Behavior */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Section title="Conversation dominance" delay={0.15}>
                {dominanceEntries.length === 0 ? (
                  <p className="text-sm text-white/35">Insufficient data.</p>
                ) : (
                  <div className="flex items-center gap-5">
                    <div className="h-36 w-36 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={dominanceEntries} dataKey="value" nameKey="name" innerRadius={32} outerRadius={55} paddingAngle={3}>
                            {dominanceEntries.map((_, i) => (
                              <Cell key={i} fill={DOMINANCE_COLORS[i % DOMINANCE_COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1.5 text-xs text-white/60">
                      {dominanceEntries.map((e, i) => (
                        <div key={e.name} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DOMINANCE_COLORS[i % DOMINANCE_COLORS.length] }} />
                          Speaker {e.name}: <span className="font-bold text-white/80">{e.value.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              <Section title="Behavior signals" icon={Flag} delay={0.17}>
                <div className="grid gap-1.5">
                  {["anxious", "avoidant", "manipulation", "clinginess", "indifference", "inconsistency"].map((key) => {
                    const active = behaviorFlags[key];
                    return (
                      <div key={key} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${active ? "bg-red-500/10 border border-red-500/20 text-red-300" : "bg-white/3 border border-white/6 text-white/40"}`}>
                        <span className="capitalize font-medium">{key}</span>
                        <span className="flex items-center gap-1">
                          {active ? <><AlertCircle size={9} /> Detected</> : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>

            {/* Keywords */}
            {keywordClusters.length > 0 && (
              <Section title="Top keywords" icon={Tag} delay={0.2}>
                <div className="flex flex-wrap gap-2">
                  {keywordClusters.map((k, i) => (
                    <div key={k.keyword} className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/3 px-2.5 py-1.5">
                      <span className="text-xs font-medium text-white/70">{k.keyword}</span>
                      <span className="text-[10px] text-white/30 tabular-nums">×{k.count}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
