import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { ServiceWorkerGuard } from "@/components/shared/service-worker-guard";
import "@/styles/globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap"
});

// Runs before first paint to avoid a theme flash. Keep key in sync with use-theme.ts.
const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;var t=null;try{t=localStorage.getItem("ascension.theme")}catch(e){}var dark=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);d.classList.toggle("dark",dark)})()`;

export const metadata: Metadata = {
  title: {
    default: "Ascension",
    template: "%s | Ascension"
  },
  description: "Premium strength training and nutrition tracking.",
  applicationName: "Ascension",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/Ascension-icon.png",
    shortcut: "/icons/Ascension-icon.png",
    apple: "/icons/Ascension-icon.png"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ascension"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" }
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <ServiceWorkerGuard />
        {children}
      </body>
    </html>
  );
}
