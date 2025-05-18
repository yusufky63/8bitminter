import { NextResponse } from 'next/server';

export async function GET() {
  // Ensure we use HTTPS for all URLs
  const appUrl = (process.env.NEXT_PUBLIC_URL || 'https://8bitminter.vercel.app').replace('http://', 'https://');
  
  const farcasterConfig = {
    // You'll need to generate these values using Warpcast developer tools
    // Visit https://warpcast.com/~/developers/frames to generate them
    accountAssociation: {
      "header": "eyJmaWQiOjg2NDc5MywidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweENjZTJFMjI5NzNmMUY1MTA5MjQzQTZiNkREZTdBNDk4QzlENjYzNjYifQ",
      "payload": "eyJkb21haW4iOiJtb25hZC1jb3VudGVyLnZlcmNlbC5hcHAifQ",
      "signature": "MHgyMjMyYWRmMWY5NTJiN2UxM2UwYzU3YTdlNGNiNmNlODNhNWIzMjk5ZDY1YjQyZjJkNDZiY2FmNmZmZmYyM2ZhNThiZjRkNGU2OThmYTM4OWVlM2RhNmIwYjZkODAyNjdmOGMyMWEyNDIwMDhkM2RlMjlkNjMxMzYyYjI4NjUwMzFj"
    },
    frame: {
      version: "1",
      name: "8BitMinter",
      description: "Create and mint your own 8-bit style tokens on the blockchain.",
      iconUrl: `${appUrl}/images/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/images/feed.png`,
      screenshotUrls: [
        `${appUrl}/images/feed.png`
      ],
      tags: ["nft", "tokens", "blockchain", "web3", "8bit", "retro"],
      primaryCategory: "creation",
      buttonTitle: "Start Minting",
      splashImageUrl: `${appUrl}/images/splash.png`,
      splashBackgroundColor: "#181028"
    }
  };

  return NextResponse.json(farcasterConfig);
} 