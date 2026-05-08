"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const THEMES = ["dark", "light", "system"];

function getSystemPreference() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const resolved = theme === "system" ? getSystemPreference() : theme;
  document.documentElement.setAttribute("data-theme", resolved);

  if (resolved === "light") {
    document.documentElement.style.setProperty("--bg-page", "#F5F1EB");
    document.documentElement.style.setProperty("--text-page", "#0A0A0A");
    document.documentElement.style.setProperty("--surface-page", "#EDEAD5");
  } else {
    document.documentElement.style.setProperty("--bg-page", "#0A0A0A");
    document.documentElement.style.setProperty("--text-page", "#F5F1EB");
    document.documentElement.style.setProperty("--surface-page", "#141414");
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("chatvibe-theme") || "dark";
    setTheme(saved);
    applyTheme(saved);
    setMounted(true);

    // Listen for system preference changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (localStorage.getItem("chatvibe-theme") === "system") {
        applyTheme("system");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function cycle() {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
    localStorage.setItem("chatvibe-theme", next);
    applyTheme(next);
  }

  if (!mounted) return null;

  const icons = { dark: "🌙", light: "☀️", system: "⚙️" };
  const labels = { dark: "Dark", light: "Light", system: "System" };

  return (
    <motion.button
      onClick={cycle}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch theme (current: ${theme})`}
      title={`Theme: ${labels[theme]} — click to cycle`}
      style={{
        background: "rgba(245,241,235,0.06)",
        border: "1px solid rgba(245,241,235,0.1)",
        borderRadius: "2px",
        padding: "0.35rem 0.65rem",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        fontSize: "0.72rem",
        color: "rgba(245,241,235,0.6)",
        fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
        transition: "border-color 0.15s",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={theme}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.12 }}
          style={{ fontSize: "0.85rem" }}
        >
          {icons[theme]}
        </motion.span>
      </AnimatePresence>
      {labels[theme]}
    </motion.button>
  );
}
