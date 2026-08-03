import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ZITTOSITE — Digital IMEI Activation Platform",
    template: "%s · ZITTOSITE",
  },
  description:
    "Platform order layanan aktivasi IMEI. Buat order, bayar, dan pantau statusnya dari satu tempat.",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-full font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
