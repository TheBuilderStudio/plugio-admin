import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plugio Admin",
  description: "Internal administration panel for Plugio",
  robots: "noindex, nofollow", // Never index admin panels
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
