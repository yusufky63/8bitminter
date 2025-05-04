import "./globals.css";
import "@fontsource/press-start-2p";
import "@fontsource/vt323";
import Providers from "./providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL || 'https://visionz-mini.vercel.app'),
  title: "VisionZ Retro",
  description: "Create RETRO AI-powered tokens on Farcaster",
  openGraph: {
    title: 'VisionZ Retro',
    description: 'Create retro-style tokens on Base',
    images: '/opengraph-image.png',
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': '/opengraph-image.png',
    'fc:frame:button:1': 'Create Vision',
    'fc:frame:post_url': `${process.env.NEXT_PUBLIC_URL || 'https://visionz-mini.vercel.app'}/api/frame`,
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
