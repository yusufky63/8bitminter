import "./globals.css";
import "@fontsource/press-start-2p";
import "@fontsource/vt323";
import Providers from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Ensure URL doesn't end with a slash to avoid double slashes
  const baseUrl = (process.env.NEXT_PUBLIC_URL || 'https://8bitminter.vercel.app').replace(/\/$/, '');
  
  return (
    <html lang="en">
      <head>
        <title>8BitMinter</title>
        <meta
          name="description"
          content="Create retro-styled tokens on the blockchain with AI-generated art"
        />
        <link rel="icon" href="/logo.png" />
        <meta name="theme-color" content="#6366F1" />
        
        {/* OpenGraph Meta Tags */}
        <meta property="og:title" content="8BitMinter" />
        <meta
          property="og:description"
          content="Create retro-styled tokens on the blockchain with AI-generated art"
        />
        <meta property="og:image" content={`${baseUrl}/opengraph-image.png`} />
        
        {/* Twitter Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="8BitMinter" />
        <meta name="twitter:description" content="Create retro-style tokens on Base" />
        <meta name="twitter:image" content={`${baseUrl}/opengraph-image.png`} />
        
        {/* Farcaster Frame Meta Tags */}
        <meta name="fc:frame" content="vNext" />
        <meta name="fc:frame:image" content={`${baseUrl}/opengraph-image.png`} />
        <meta name="fc:frame:button:1" content="Create Token" />
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
