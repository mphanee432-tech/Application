import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeServe Pro | Partner & Field Operations Portal",
  description: "Live job broadcast feed, turn-by-turn navigation, service checklists, and automated earnings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
