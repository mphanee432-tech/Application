import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeServe Operations HQ | Admin Command Center",
  description: "Live dispatch control, KYC professional verification, dispute resolution, and platform financials.",
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
