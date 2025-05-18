import { NextResponse } from 'next/server';

export const revalidate = 3600; // Revalidate at most every hour

export async function GET() {
  // Ensure we use HTTPS for all URLs
  const appUrl = (process.env.NEXT_PUBLIC_URL || 'https://8bitminter.vercel.app').replace('http://', 'https://');
  
  const farcasterConfig = {
    // You'll need to generate these values using Warpcast developer tools
    // Visit https://warpcast.com/~/developers/frames to generate them
    accountAssociation: {
      "header": "",
      "payload": "",
      "signature": ""
    },
    frame: {
      version: "1",
      name: "8BitMinter",
      description: "Create and mint your own 8-bit style tokens on the blockchain.",
      iconUrl: `${appUrl}/logo.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/opengraph-image.png`,
      screenshotUrls: [
        `${appUrl}/images/screenshot1.png`
      ],
      tags: ["nft", "tokens", "blockchain", "web3", "8bit", "retro"],
      primaryCategory: "creation",
      buttonTitle: "Create Token",
      splashImageUrl: `${appUrl}/logo.png`,
      splashBackgroundColor: "#181028"
    }
  };

  // Add headers to the response
  const response = NextResponse.json(farcasterConfig);
  
  // Set cache control headers
  response.headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  response.headers.set('X-Frame-Options', 'ALLOW-FROM https://warpcast.com');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'self' https://warpcast.com https://*.warpcast.com");
  
  return response;
} 