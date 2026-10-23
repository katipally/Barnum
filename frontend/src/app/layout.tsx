import type { Metadata } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Barnum",
  description: "Barnum: a CMO agent that turns business goals into marketing decisions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${geistMono.variable} bg-bg text-ink antialiased`}>
        {/* useCaseId reads useSearchParams, which needs a Suspense boundary */}
        <Suspense fallback={<div className="min-h-screen bg-bg" />}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
