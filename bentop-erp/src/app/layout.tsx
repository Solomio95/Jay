import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bentop Collection ERP",
  description: "Enterprise Resource Planning system for Bentop Collection — Inventory & Sales Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
