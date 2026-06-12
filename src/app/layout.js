import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "FIXify - Helper Console",
  description: "High-performance log processor and diagnostics tools for the FIX protocol.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col overflow-x-hidden transition-colors duration-200`}
      >
        <Navbar />
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)] transition-colors duration-200">
          <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-screen-2xl mx-auto w-full">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
