import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/core/AppProviders";

export const metadata: Metadata = {
  title: "Inventory Management",
  description: "Inventory Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

