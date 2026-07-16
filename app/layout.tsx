import type { Metadata, Viewport } from "next";
import SwRegister from "@/components/SwRegister";
import "./globals.css";

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
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-mist text-ink dark:bg-ink dark:text-mist">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
