import { NextResponse } from 'next/server';

export async function GET() {
  // Ensure we use HTTPS for all URLs
  const appUrl = (process.env.NEXT_PUBLIC_URL || 'https://8bitminter.vercel.app').replace('http://', 'https://');
  
  const manifest = {
    accountAssociation: {
      "header": "eyJmaWQiOjg2NDc5MywidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweENjZTJFMjI5NzNmMUY1MTA5MjQzQTZiNkREZTdBNDk4QzlENjYzNjYifQ",
      "payload": "eyJkb21haW4iOiI4Yml0bWludGVyLnZlcmNlbC5hcHAifQ",
      "signature": "MHhkMTIzZDUwNDZkZDE5MjlhMmNiMzMyM2FiM2M4Y2M5OTdiMWVjMjZjMjgxODM5Yzg3YmUxZTJlYzBhMDA0Mzg5NzE5NmYxMjlhMWI5OTA0NzA3MzU3MDlhMWUwMjk1YTIxMjU1OTNlYTE5MWFmYjhmMzI3MzAwZGY4NTg1YWY3MjFi"
    },
    miniApp: {
      version: "1",
      name: "8BitMinter",
      description: "Create retro-styled tokens on the blockchain with AI-generated art",
      iconUrl: `${appUrl}/logo.png`,
      homeUrl: appUrl,
      installUrl: appUrl,
      splashImageUrl: `${appUrl}/logo.png`,
      splashBackgroundColor: "#181028",
      primaryCategory: "art-creativity",
      tags: ["nft", "tokens", "blockchain", "web3", "8bit"],
      screenshotUrls: [
        `${appUrl}/images/screenshot1.png`
      ],
      permissions: [],
      notificationsEnabled: false,
      enableInAppNotifications: false,
      openInNewTab: false
    }
  };

  // Set cache control headers
  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 's-maxage=1, stale-while-revalidate'
    }
  });
} 