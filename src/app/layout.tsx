import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Allo — Inventory",
  description: "Multi-warehouse inventory reservation system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background text-foreground`}>
        {children}
        {/* Toast notifications sit at the top-right, above everything */}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}