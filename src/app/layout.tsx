import "./globals.css";
import "@fontsource/press-start-2p";
import "@fontsource/vt323";
import Providers from "./providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VisionZ Coin Maker",
  description: "Create RETRO AI-powered tokens on Farcaster",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" />
        <meta name="theme-color" content="#6366F1" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
