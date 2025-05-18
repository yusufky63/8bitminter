import { NextResponse } from 'next/server';

export async function GET() {
  // Ensure we use HTTPS for all URLs
  const appUrl = (process.env.NEXT_PUBLIC_URL || 'https://8bitminter.vercel.app').replace('http://', 'https://');
  
  const farcasterConfig = {
    // Using the provided accountAssociation values
    accountAssociation: {
      "header": "eyJmaWQiOjg2NDc5MywidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweENjZTJFMjI5NzNmMUY1MTA5MjQzQTZiNkREZTdBNDk4QzlENjYzNjYifQ",
      "payload": "eyJkb21haW4iOiI4Yml0bWludGVyLnZlcmNlbC5hcHAifQ",
      "signature": "MHhkMTIzZDUwNDZkZDE5MjlhMmNiMzMyM2FiM2M4Y2M5OTdiMWVjMjZjMjgxODM5Yzg3YmUxZTJlYzBhMDA0Mzg5NzE5NmYxMjlhMWI5OTA0NzA3MzU3MDlhMWUwMjk1YTIxMjU1OTNlYTE5MWFmYjhmMzI3MzAwZGY4NTg1YWY3MjFi"
    },
    frame: {
      version: "1",
      name: "8BitMinter",
      description: "Create and mint your own 8-bit style tokens on the blockchain.",
      iconUrl: "https://8bitminter.vercel.app/logo.png",
      homeUrl: appUrl,
      imageUrl: "https://8bitminter.vercel.app/opengraph-image.png",
      screenshotUrls: [
        "https://8bitminter.vercel.app/images/screenshot1.png"
      ],
      tags: ["nft", "tokens", "blockchain", "web3", "8bit"],
      primaryCategory: "art-creativity",
      buttonTitle: "Launch 8BitMinter",
      splashImageUrl: "https://8bitminter.vercel.app/logo.png",
      splashBackgroundColor: "#181028",
      webhookUrl: "https://8bitminter.vercel.app/api/webhook"
    }
  };

  return NextResponse.json(farcasterConfig);
} 