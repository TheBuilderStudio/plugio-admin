import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Match plugio-frontend primary typeface */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,slnt,wdth,wght,ROND@8..144,-10..0,25..150,400..1000,0..100&display=swap"
        />
        <meta name="theme-color" content="#0A0908" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
