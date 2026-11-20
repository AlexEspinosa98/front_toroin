import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { RegistrarSW } from "@/components/RegistrarSW";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TOROIN · Plataforma",
  description: "Gestión de obra, personal y finanzas para constructoras",
  appleWebApp: { capable: true, title: "TOROIN", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#19185A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <head><link rel="manifest" href="/api/manifest" crossOrigin="use-credentials" /></head>
      <body className="min-h-screen antialiased">{children}<RegistrarSW /></body>
    </html>
  );
}
