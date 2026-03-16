import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trail Narrator — Your AI Park Ranger",
  description:
    "Upload trail photos and experience immersive geological storytelling with AI-generated time-travel imagery. See what your landscape looked like millions of years ago.",
  keywords: [
    "trail narrator",
    "AI park ranger",
    "geological storytelling",
    "time travel imagery",
    "national parks",
    "Gemini AI",
    "trail photos",
    "geology",
  ],
  authors: [{ name: "Trail Narrator" }],
  metadataBase: new URL("https://trailnarrator.com"),
  openGraph: {
    title: "Trail Narrator — Your AI Park Ranger",
    description:
      "Upload trail photos and experience immersive geological storytelling with AI-generated time-travel imagery.",
    url: "https://trailnarrator.com",
    siteName: "Trail Narrator",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Trail Narrator Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trail Narrator — Your AI Park Ranger",
    description:
      "Upload trail photos and experience immersive geological storytelling with AI-generated time-travel imagery.",
    images: ["/logo.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  themeColor: "#2c6b3e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#FDFBF7] text-[#331f16] antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
