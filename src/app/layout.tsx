import type { Metadata } from "next";
import { Google_Sans_Flex } from "next/font/google";
import "./globals.css";

// Self-hosted at build time by next/font; matches the plugio-frontend primary typeface.
const googleSansFlex = Google_Sans_Flex({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-google-sans-flex",
  adjustFontFallback: false, // no fallback metrics are published for this family
});

export const metadata: Metadata = {
  title: "Plugio Console",
  description: "Internal operations console for Plugio",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={googleSansFlex.variable} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0A0908" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
