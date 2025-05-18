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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta
          name="description"
          content="Create retro-styled tokens on the blockchain with AI-generated art"
        />
        <link rel="icon" href="/logo.png" />
        <meta name="theme-color" content="#181028" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* OpenGraph Meta Tags */}
        <meta property="og:title" content="8BitMinter" />
        <meta
          property="og:description"
          content="Create retro-styled tokens on the blockchain with AI-generated art"
        />
        <meta property="og:image" content={`${baseUrl}/opengraph-image.png`} />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:type" content="website" />
        
        {/* Twitter Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="8BitMinter" />
        <meta name="twitter:description" content="Create retro-style tokens on Base" />
        <meta name="twitter:image" content={`${baseUrl}/opengraph-image.png`} />
        
        {/* Farcaster Frame configuration */}
        <meta name="fc:frame" content="vNext" />
        <meta name="fc:frame:image" content={`${baseUrl}/opengraph-image.png`} />
        <meta name="fc:frame:button:1" content="Create Token" />

        {/* Farcaster Mini App configuration */}
        <meta name="miniapp:name" content="8BitMinter" />
        <meta name="miniapp:url" content={baseUrl} />
        <meta name="miniapp:platform" content="farcaster" />
        <meta name="miniapp:splash:background" content="#181028" />
        <meta name="miniapp:splash:image" content={`${baseUrl}/logo.png`} />
        
        {/* X-Frame-Options - Allow embedding from Warpcast */}
        <meta httpEquiv="X-Frame-Options" content="ALLOW-FROM https://warpcast.com" />
        <meta httpEquiv="Content-Security-Policy" content="frame-ancestors 'self' https://warpcast.com https://*.warpcast.com" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
