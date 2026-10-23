import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Nunito, Noto_Sans_Devanagari } from "next/font/google";
import { Providers } from "@/components/shell/providers";
import { BootScreen } from "@/components/shell/boot";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], display: "swap" });
const devanagari = Noto_Sans_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"], weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "SMARAN · स्मरण — Your voice remembers",
  description: "SMARAN turns the way families already talk into health reminders, confirmations and a shared family health memory.",
  applicationName: "SMARAN",
};

export const viewport: Viewport = {
  themeColor: "#FDEEE6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} ${devanagari.variable} h-full antialiased`}>
      <body className="min-h-full bg-ivory">
        <Suspense fallback={<BootScreen />}>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}
