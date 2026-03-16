import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trail Narrator — Your AI Park Ranger",
  description:
    "Upload trail photos and experience immersive geological storytelling with AI-generated time-travel imagery.",
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
      </body>
    </html>
  );
}
