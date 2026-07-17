import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import SwRegister from "@/components/SwRegister";
import "./globals.css";

// Downtown editorial: Fraunces for anything human, Inter for micro-labels.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-fraunces",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Pulse",
  description: "A 30-second anonymous shift check-in for hospital nurses.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pulse",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#201e1d",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh bg-mist text-ink dark:bg-ink dark:text-mist">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
