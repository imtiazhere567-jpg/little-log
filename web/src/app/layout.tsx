import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import NavProgress from "@/components/NavProgress";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Littlelog · Daycare daily reports (demo)",
  description: "Teachers speak, AI writes warm daily reports, directors approve incidents. A portfolio demo.",
};

export const viewport: Viewport = {
  themeColor: "#FBF7F0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full"><Suspense fallback={null}><NavProgress /></Suspense>{children}</body>
    </html>
  );
}
