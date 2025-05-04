import "./globals.css";
import "@fontsource/press-start-2p";
import "@fontsource/vt323";
import Providers from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://visionz-mini.vercel.app';
  
  return (
    <html lang="en">
      <head>
        <title>VisionZ Retro</title>
        <meta name="description" content="Create RETRO AI-powered tokens on Farcaster" />
        <link rel="icon" href="/logo.png" />
        <meta name="theme-color" content="#6366F1" />
        
        {/* OpenGraph Meta Tags */}
        <meta property="og:title" content="VisionZ Retro" />
        <meta property="og:description" content="Create retro-style tokens on Base" />
        <meta property="og:image" content={`${baseUrl}/opengraph-image.png`} />
        
        {/* Farcaster Frame Meta Tags */}
        <meta name="fc:frame" content="vNext" />
        <meta name="fc:frame:image" content={`${baseUrl}/opengraph-image.png`} />
        <meta name="fc:frame:button:1" content="Create Vision" />
        <meta name="fc:frame:post_url" content={`${baseUrl}/api/frame`} />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
