import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "ChatVibe AI — Decode every conversation",
  description: "Upload chat screenshots. ChatVibe AI runs OCR and psychological analysis powered by Gemini to surface emotional patterns, behavior flags, and relationship insights.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#7c4dff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen text-white antialiased">
        <Navbar />
        <main className="relative z-10 min-h-[calc(100vh-4rem)]" role="main">
          {children}
        </main>
        <footer className="relative z-10 border-t border-white/6 bg-transparent py-6 text-center text-xs text-white/25">
          © {new Date().getFullYear()} ChatVibe AI · Built with Gemini 2.5 Flash
        </footer>
      </body>
    </html>
  );
}
