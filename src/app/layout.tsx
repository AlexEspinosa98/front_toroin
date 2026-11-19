import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TOROIN · Plataforma",
  description: "Gestión de obra, personal y finanzas para constructoras",
};
export const viewport: Viewport = { themeColor: "#19185A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
