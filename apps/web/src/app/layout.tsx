import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ZITTOSITE — Digital IMEI Activation Platform",
    template: "%s · ZITTOSITE",
  },
  description:
    "Platform order layanan aktivasi IMEI. Buat order, bayar, dan pantau statusnya dari satu tempat.",
};

export const viewport: Viewport = {
  themeColor: "#1453C7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`h-full ${atkinson.variable}`}>
      <body className="min-h-full font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
