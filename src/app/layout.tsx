import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@fontsource/press-start-2p";
import "@fontsource/vt323";
import Providers from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_URL || "https://8bitminter.vercel.app"
  ),
  title: "8BitCoiner",
  description: "Create and mint 8-bit inspired tokens with AI-generated art on Base.",
  keywords: ["Base", "tokens", "blockchain", "web3", "8bit", "nft", "retro", "AI", "art"],
  authors: [{ name: "8BitCoiner Team" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "8BitCoiner",
    description: "Create and mint 8-bit inspired tokens with AI-generated art on Base.",
    type: "website",
    url: "https://8bitminter.vercel.app",
    images: [
      {
        url: "https://8bitminter.vercel.app/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "8BitCoiner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "8BitCoiner",
    description: "Create retro-styled tokens on the blockchain with AI-generated art",
    images: ["https://8bitminter.vercel.app/opengraph-image.png"],
  },
  other: {
    "fc:miniapp": JSON.stringify({
      version: "next",
      imageUrl: "https://8bitminter.vercel.app/opengraph-image.png",
      button: {
        title: "Launch 8BitCoiner",
        action: {
          type: "launch_miniapp",
          name: "8BitCoiner",
          url: "https://8bitminter.vercel.app",
          splashImageUrl: "https://8bitminter.vercel.app/splash.png",
          splashBackgroundColor: "#181028"
        }
      }
    })
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#181028",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Farcaster manifest */}
        <link rel="farcaster-app-config" href="/.well-known/farcaster.json" />
        
        {/* Allow embedding from anywhere */}
        <meta httpEquiv="X-Frame-Options" content="ALLOWALL" />
        <meta httpEquiv="Content-Security-Policy" content="frame-ancestors *" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
