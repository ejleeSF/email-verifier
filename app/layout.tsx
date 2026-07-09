import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Check whether an email address is real and deliverable — syntax, MX records, disposable domains, typo detection, and role-account heuristics. Free.";

export const metadata: Metadata = {
  metadataBase: new URL("https://verify.ejlee.io"),
  title: "Email Verifier",
  description,
  openGraph: {
    title: "Email Verifier",
    description,
    url: "https://verify.ejlee.io",
    siteName: "Email Verifier",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Email Verifier",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
