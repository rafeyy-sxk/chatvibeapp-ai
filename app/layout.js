import "./globals.css";
import { Fraunces, DM_Sans } from "next/font/google";
import Navbar from "@/components/Navbar";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "ChatVibe AI — Image → Result in Under 5 Seconds",
  description:
    "Upload any image. ChatVibe AI uses Groq + Llama 3.2 Vision to surface insights in under 5 seconds — no setup required. Built by Abdul Rafey.",
  keywords: [
    "AI image analysis",
    "Llama 3.2 vision",
    "private document analysis",
    "chat screenshot analysis",
    "AI under 5 seconds",
  ],
  authors: [{ name: "Abdul Rafey", url: "https://github.com/rafeyy-sxk" }],
  openGraph: {
    title: "ChatVibe AI — Image → Result in Under 5 Seconds",
    description:
      "Groq + Llama 3.2 Vision analysis. Image → insights in under 5s. No setup required.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ChatVibe AI — local OCR + AI analysis in under 5 seconds",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ChatVibe AI — Image → Result in 4.7s",
    description: "Groq + Llama 3.2 Vision. Image → analysis in under 5s. Built by @rafeyy_sxk",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#C97B4F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`scroll-smooth ${fraunces.variable} ${dmSans.variable}`}
    >
      <body
        className="min-h-screen antialiased"
        style={{
          background: "#0B0B0E",
          color: "#F2EDE4",
          fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
        }}
      >
        <Navbar />
        <main className="relative z-10 min-h-[calc(100vh-4rem)]" role="main">
          {children}
        </main>
        <footer
          className="relative z-10 border-t py-6 text-center text-xs"
          style={{
            borderColor: "rgba(245,241,235,0.06)",
            color: "rgba(245,241,235,0.22)",
            fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
          }}
        >
          © {new Date().getFullYear()} ChatVibe AI · Built by{" "}
          <a
            href="https://github.com/rafeyy-sxk"
            style={{ color: "rgba(245,241,235,0.4)", textDecoration: "none" }}
          >
            Abdul Rafey
          </a>{" "}
          · Powered by Llama 3.2
        </footer>
      </body>
    </html>
  );
}
