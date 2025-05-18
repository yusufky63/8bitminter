"use client";

import "./globals.css";
import "@fontsource/press-start-2p";
import "@fontsource/vt323";
import Providers from "./providers";
import { useEffect, useState } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Ensure URL doesn't end with a slash to avoid double slashes
  const [baseUrl, setBaseUrl] = useState('https://8bitminter.vercel.app');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = (process.env.NEXT_PUBLIC_URL || window.location.origin).replace(/\/$/, '');
      setBaseUrl(url);
    }
  }, []);
  
  // Define the Farcaster frame JSON
  const frameJson = {
    version: "next",
    imageUrl: `${baseUrl}/opengraph-image.png`,
    button: {
      title: "Start Minting",
      action: {
        type: "launch_frame",
        name: "8BitMinter",
        url: baseUrl,
        splashImageUrl: `${baseUrl}/logo.png`,
        splashBackgroundColor: "#181028"
      }
    }
  };
  
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
        
        {/* Farcaster mini app manifest */}
        <link rel="farcaster-app-config" href="/.well-known/farcaster/manifest.json" />
        
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
        <meta name="fc:frame" content={JSON.stringify(frameJson)} />
        <meta name="fc:frame:image" content={`${baseUrl}/opengraph-image.png`} />
        <meta name="fc:frame:button:1" content="Start Minting" />

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
