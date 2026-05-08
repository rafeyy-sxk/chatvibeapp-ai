"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Link from "next/link";

// â"€â"€ Static grain overlay (zero JS, zero perf cost) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function GrainOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        opacity: 0.022,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "140px",
      }}
    />
  );
}

// â"€â"€ Single CSS-animated amber glow (GPU transform only, 8s loop) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Option B: no canvas, no JS, no layout thrash — just transform: scale on a
// blurred div. Compositor-only path guarantees 60fps.
function AmbientGlow() {
  return (
    <>
      <style>{`
        @keyframes glowPulse {
          0%,100% { transform: translate3d(-50%,-50%,0) scale(1); }
          50%      { transform: translate3d(-50%,-50%,0) scale(1.05); }
        }
        .ambient-glow {
          position: fixed;
          left: 50%;
          top: 28%;
          width: 680px;
          height: 680px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(201,123,79,0.09) 0%, transparent 70%);
          filter: blur(80px);
          animation: glowPulse 8s ease-in-out infinite;
          pointer-events: none;
          z-index: 0;
          will-change: transform;
        }
        .ambient-glow-2 {
          position: fixed;
          left: 78%;
          top: 62%;
          width: 360px;
          height: 360px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(201,123,79,0.045) 0%, transparent 70%);
          filter: blur(60px);
          animation: glowPulse 12s ease-in-out infinite reverse;
          pointer-events: none;
          z-index: 0;
          will-change: transform;
        }
      `}</style>
      <div className="ambient-glow" aria-hidden="true" />
      <div className="ambient-glow-2" aria-hidden="true" />
    </>
  );
}

// â"€â"€ Scroll-triggered reveal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function Reveal({ children, delay = 0, className = "", style = {} }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// â"€â"€ Data â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const FEATURES = [
  {
    title: "Streams as it thinks",
    desc: "Results appear token by token. No spinner. No waiting.",
  },
  {
    title: "Multi-image batch",
    desc: "Up to 10 images processed in parallel.",
  },
  {
    title: "Ask follow-up questions",
    desc: "Chat with any result after analysis.",
  },
  {
    title: "Export PDF, JSON, CSV",
    desc: "Every report in the format you need.",
  },
  {
    title: "Search every past run",
    desc: "Full-text search across your entire history.",
  },
];

const FAQS = [
  {
    q: "How does the AI work?",
    a: "Powered by Groq + Llama 3.2 Vision. Images are processed server-side and never stored.",
  },
  {
    q: "How fast is it?",
    a: "Under 5 seconds median on any modern laptop (M1/M2 or mid-range Intel).",
  },
  {
    q: "What image formats?",
    a: "JPG, PNG, WebP, HEIC, AVIF — up to 10MB per image.",
  },
  {
    q: "Is there a setup required?",
    a: "No setup needed. Just sign up and drop an image — analysis starts instantly.",
  },
];

const AMBER = "#C97B4F";
const CREAM = "#F2EDE4";
const INK = "#0B0B0E";

// â"€â"€ Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
export default function HomePage() {
  const [openFaq, setOpenFaq] = useState(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 320], [1, 0]);
  const heroY = useTransform(scrollY, [0, 320], [0, -40]);

  const sectionLabel = {
    fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
    fontSize: "0.65rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: `rgba(201,123,79,0.75)`,
    marginBottom: "0.6rem",
  };

  const sectionHeading = {
    fontFamily: "var(--font-fraunces, 'Fraunces', Georgia, serif)",
    fontWeight: 800,
    lineHeight: 1.02,
    letterSpacing: "-0.025em",
    color: CREAM,
  };

  const bodyFont = {
    fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
  };

  return (
    <>
      <AmbientGlow />
      <GrainOverlay />

      {/* â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ HERO â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <motion.section
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative z-10 flex min-h-[100svh] flex-col justify-center"
        aria-label="Hero"
      >
        <div
          style={{
            maxWidth: 1340,
            margin: "0 auto",
            padding: "0 clamp(1.5rem, 5vw, 6rem)",
            width: "100%",
          }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "2rem",
            }}
          >
            <span
              style={{
                background: `rgba(201,123,79,0.08)`,
                border: `1px solid rgba(201,123,79,0.25)`,
                color: AMBER,
                fontSize: "0.65rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                padding: "0.3rem 0.8rem",
                borderRadius: "2px",
                fontWeight: 500,
                ...bodyFont,
              }}
            >
              Powered by Llama 3.2 Vision
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            style={{
              ...sectionHeading,
              fontSize: "clamp(3.5rem, 10vw, 9rem)",
              fontStyle: "italic",
              maxWidth: "14ch",
              marginBottom: "1.5rem",
              color: CREAM,
            }}
          >
            Image in.
            <br />
            <span style={{ color: AMBER, fontStyle: "normal" }}>Answer out.</span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              ...bodyFont,
              fontSize: "clamp(0.9rem, 1.8vw, 1.1rem)",
              color: `rgba(242,237,228,0.48)`,
              maxWidth: "38ch",
              lineHeight: 1.75,
              marginBottom: "2.25rem",
            }}
          >
            Local AI. Five seconds. Private.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.34 }}
            style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "3.5rem" }}
          >
            <Link
              href="/upload"
              style={{
                background: AMBER,
                color: INK,
                ...bodyFont,
                fontWeight: 700,
                fontSize: "0.875rem",
                padding: "0.85rem 1.75rem",
                borderRadius: "2px",
                textDecoration: "none",
                letterSpacing: "0.01em",
              }}
            >
              Try it
            </Link>
            <Link
              href="/signup"
              style={{
                border: `1px solid rgba(242,237,228,0.15)`,
                color: `rgba(242,237,228,0.65)`,
                ...bodyFont,
                fontWeight: 500,
                fontSize: "0.875rem",
                padding: "0.85rem 1.75rem",
                borderRadius: "2px",
                textDecoration: "none",
              }}
            >
              See it work
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.52 }}
            style={{ display: "flex", flexWrap: "wrap", gap: "3rem" }}
          >
            {[
              ["< 5s", "median analysis"],
              ["100%", "local processing"],
              ["$0", "per analysis"],
            ].map(([stat, label]) => (
              <div key={stat}>
                <div
                  style={{
                    fontFamily: "var(--font-fraunces, 'Fraunces', serif)",
                    fontSize: "2.1rem",
                    fontWeight: 800,
                    color: CREAM,
                    lineHeight: 1,
                  }}
                >
                  {stat}
                </div>
                <div
                  style={{
                    ...bodyFont,
                    fontSize: "0.65rem",
                    color: `rgba(242,237,228,0.28)`,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginTop: "0.3rem",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ HOW IT WORKS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <section
        className="relative z-10"
        style={{
          maxWidth: 1340,
          margin: "0 auto",
          padding: "8rem clamp(1.5rem, 5vw, 6rem)",
        }}
        aria-label="How it works"
      >
        <Reveal style={{ marginBottom: "4rem" }}>
          <div style={sectionLabel}>Process</div>
          <h2 style={{ ...sectionHeading, fontSize: "clamp(2rem, 5vw, 4.2rem)" }}>
            Three steps.
            <br />
            Under 5 seconds.
          </h2>
        </Reveal>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1px",
            background: "rgba(242,237,228,0.05)",
          }}
        >
          {[
            { n: "01", title: "Drop the image.", detail: "Any format. Up to 10MB." },
            { n: "02", title: "Llama 3.2 Vision reads it.", detail: "Direct vision AI. ~2s. Streaming." },
            { n: "03", title: "Read the answer.", detail: "Streamed to screen. No wait." },
          ].map((step, i) => (
            <Reveal key={step.n} delay={i * 0.07}>
              <motion.div
                whileHover={{ x: 8 }}
                transition={{ duration: 0.16 }}
                style={{
                  background: INK,
                  padding: "2rem clamp(1.25rem, 3vw, 2.5rem)",
                  display: "grid",
                  gridTemplateColumns: "3.5rem 1fr auto",
                  gap: "2rem",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-fraunces, 'Fraunces', serif)",
                    fontSize: "2.6rem",
                    fontWeight: 900,
                    color: `rgba(201,123,79,0.15)`,
                    lineHeight: 1,
                  }}
                >
                  {step.n}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-fraunces, 'Fraunces', serif)",
                    fontSize: "clamp(1.1rem, 2.5vw, 1.4rem)",
                    fontWeight: 700,
                    color: CREAM,
                  }}
                >
                  {step.title}
                </div>
                <div
                  style={{
                    ...bodyFont,
                    fontSize: "0.65rem",
                    color: `rgba(201,123,79,0.5)`,
                    textAlign: "right",
                    maxWidth: "14ch",
                    lineHeight: 1.6,
                    flexShrink: 0,
                  }}
                >
                  {step.detail}
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ FEATURES â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <section
        className="relative z-10"
        style={{
          maxWidth: 1340,
          margin: "0 auto",
          padding: "2rem clamp(1.5rem, 5vw, 6rem) 8rem",
        }}
        aria-label="Features"
      >
        <Reveal style={{ marginBottom: "4rem" }}>
          <div style={sectionLabel}>What it does</div>
          <h2 style={{ ...sectionHeading, fontSize: "clamp(2rem, 5vw, 4.2rem)" }}>
            Built to ship.
            <br />
            Not to impress.
          </h2>
        </Reveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
            gap: "1px",
            background: "rgba(242,237,228,0.05)",
          }}
        >
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.16 }}
                style={{
                  background: "#0D0D10",
                  padding: "1.75rem",
                  minHeight: 140,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-fraunces, 'Fraunces', serif)",
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    color: CREAM,
                    marginBottom: "0.5rem",
                  }}
                >
                  {f.title}
                </div>
                <div
                  style={{
                    ...bodyFont,
                    fontSize: "0.8rem",
                    color: `rgba(242,237,228,0.38)`,
                    lineHeight: 1.65,
                  }}
                >
                  {f.desc}
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ WHY LOCAL â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <section
        className="relative z-10"
        style={{
          maxWidth: 1340,
          margin: "0 auto",
          padding: "2rem clamp(1.5rem, 5vw, 6rem) 8rem",
        }}
        aria-label="Why local"
      >
        <Reveal style={{ marginBottom: "4rem" }}>
          <div style={sectionLabel}>Why local</div>
          <h2 style={{ ...sectionHeading, fontSize: "clamp(2rem, 5vw, 4.2rem)" }}>
            No cloud.
            <br />
            No compromise.
          </h2>
        </Reveal>

        <Reveal>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0",
              maxWidth: "56ch",
            }}
          >
            {[
              "No cloud. Nothing leaves your machine.",
              "Five-second answers, every time.",
              "You own the model.",
            ].map((line, i) => (
              <div
                key={i}
                style={{
                  borderBottom: "1px solid rgba(242,237,228,0.07)",
                  padding: "1.75rem 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "1.25rem",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: AMBER,
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-fraunces, 'Fraunces', serif)",
                    fontSize: "clamp(1rem, 2.2vw, 1.3rem)",
                    fontWeight: 600,
                    color: CREAM,
                    lineHeight: 1.3,
                  }}
                >
                  {line}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ FAQ â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <section
        className="relative z-10"
        style={{
          maxWidth: 1340,
          margin: "0 auto",
          padding: "2rem clamp(1.5rem, 5vw, 6rem) 8rem",
        }}
        aria-label="FAQ"
      >
        <Reveal style={{ marginBottom: "3rem" }}>
          <div style={sectionLabel}>FAQ</div>
          <h2 style={{ ...sectionHeading, fontSize: "clamp(1.8rem, 4.5vw, 3.5rem)" }}>
            Common questions
          </h2>
        </Reveal>

        <div style={{ maxWidth: "68ch" }}>
          {FAQS.map((faq, i) => (
            <Reveal key={i} delay={i * 0.04}>
              <div style={{ borderBottom: "1px solid rgba(242,237,228,0.07)" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    padding: "1.4rem 0",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    gap: "1rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-fraunces, 'Fraunces', serif)",
                      fontSize: "0.98rem",
                      fontWeight: 600,
                      color: CREAM,
                      lineHeight: 1.4,
                    }}
                  >
                    {faq.q}
                  </span>
                  <span
                    style={{
                      color: AMBER,
                      fontSize: "1.2rem",
                      flexShrink: 0,
                      transform: openFaq === i ? "rotate(45deg)" : "none",
                      transition: "transform 0.18s ease",
                      marginTop: "0.05rem",
                    }}
                  >
                    +
                  </span>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden" }}
                    >
                      <p
                        style={{
                          ...bodyFont,
                          fontSize: "0.85rem",
                          color: `rgba(242,237,228,0.46)`,
                          lineHeight: 1.75,
                          paddingBottom: "1.4rem",
                        }}
                      >
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ AUTHOR â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <section
        className="relative z-10"
        style={{
          maxWidth: 1340,
          margin: "0 auto",
          padding: "2rem clamp(1.5rem, 5vw, 6rem) 6rem",
          borderTop: "1px solid rgba(242,237,228,0.06)",
        }}
        aria-label="About"
      >
        <Reveal>
          <p
            style={{
              fontFamily: "var(--font-fraunces, 'Fraunces', serif)",
              fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)",
              fontStyle: "italic",
              color: `rgba(242,237,228,0.35)`,
              marginBottom: "1.25rem",
              fontWeight: 600,
            }}
          >
            Made with depth, not noise.
          </p>
          <p
            style={{
              ...bodyFont,
              fontSize: "0.88rem",
              color: `rgba(242,237,228,0.42)`,
              marginBottom: "1.5rem",
            }}
          >
            Engineered by Abdul Rafey — AI/ML & computer vision.
          </p>
          <a
            href="https://github.com/rafeyy-sxk"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              background: "rgba(242,237,228,0.05)",
              border: `1px solid rgba(242,237,228,0.12)`,
              color: `rgba(242,237,228,0.6)`,
              ...bodyFont,
              fontWeight: 500,
              fontSize: "0.82rem",
              padding: "0.6rem 1.1rem",
              borderRadius: "2px",
              textDecoration: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            github.com/rafeyy-sxk
          </a>
        </Reveal>
      </section>

      {/* â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ CTA â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <section
        className="relative z-10 text-center"
        style={{
          maxWidth: 1340,
          margin: "0 auto",
          padding: "4rem clamp(1.5rem, 5vw, 6rem) 7rem",
        }}
        aria-label="Call to action"
      >
        <Reveal>
          <h2
            style={{
              fontFamily: "var(--font-fraunces, 'Fraunces', serif)",
              fontSize: "clamp(3rem, 9vw, 7rem)",
              fontWeight: 900,
              color: CREAM,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              marginBottom: "1.75rem",
              fontStyle: "italic",
            }}
          >
            Drop an image.
            <br />
            <span style={{ color: AMBER, fontStyle: "normal" }}>Get answers.</span>
          </h2>
          <p
            style={{
              ...bodyFont,
              fontSize: "0.95rem",
              color: `rgba(242,237,228,0.38)`,
              marginBottom: "2.25rem",
            }}
          >
            No signup required for the first analysis.
          </p>
          <Link
            href="/upload"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: AMBER,
              color: INK,
              ...bodyFont,
              fontWeight: 700,
              fontSize: "0.95rem",
              padding: "1rem 2.5rem",
              borderRadius: "2px",
              textDecoration: "none",
              letterSpacing: "0.01em",
            }}
          >
            Try it free
          </Link>
        </Reveal>
      </section>

      {/* â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ FOOTER â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <footer
        style={{
          borderTop: "1px solid rgba(242,237,228,0.06)",
          padding: "1.75rem clamp(1.5rem, 5vw, 6rem)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            ...bodyFont,
            fontSize: "0.72rem",
            color: `rgba(242,237,228,0.2)`,
            letterSpacing: "0.04em",
          }}
        >
          ChatVibe AI · Built by Abdul Rafey · Powered by Llama 3.2
        </p>
      </footer>
    </>
  );
}




