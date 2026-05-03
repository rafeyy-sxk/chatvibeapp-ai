"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Zap } from "lucide-react";

const NAV_LINKS = [
  { href: "/upload", label: "Upload" },
  { href: "/analysis", label: "Analysis" },
  { href: "/billing", label: "Billing" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsLoggedIn(!!sessionStorage.getItem("cv_access_token"));
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    const token = sessionStorage.getItem("cv_access_token");
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // ignore
    }
    sessionStorage.removeItem("cv_access_token");
    sessionStorage.removeItem("cv_user");
    window.location.href = "/login";
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-white/8 bg-[#08090f]/90 backdrop-blur-xl shadow-lg shadow-black/30"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 group"
          onClick={() => setIsOpen(false)}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25 transition-transform group-hover:scale-105">
            <Zap size={14} className="text-white" fill="currentColor" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            ChatVibe{" "}
            <span className="text-violet-400">AI</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-white/8 text-white"
                  : "text-white/55 hover:text-white/90 hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Auth Button */}
        <div className="hidden md:flex items-center gap-2">
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="btn-secondary text-xs px-4 py-1.5"
            >
              Sign out
            </button>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3.5 py-1.5 text-sm font-medium text-white/60 hover:text-white/90 transition-colors"
              >
                Login
              </Link>
              <Link href="/signup" className="btn-primary text-xs px-4 py-1.5">
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="text-white/70 md:hidden p-1.5 rounded-lg hover:bg-white/8 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-white/8 bg-[#08090f]/95 backdrop-blur-2xl">
          <nav className="flex flex-col px-5 py-4 gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-white/8 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 pt-3 border-t border-white/8 flex flex-col gap-2">
              {isLoggedIn ? (
                <button
                  onClick={handleLogout}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 text-left transition-colors"
                >
                  Sign out
                </button>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="btn-primary text-center"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
