import { NextResponse } from 'next/server';

export const revalidate = 3600; // Revalidate at most every hour

export async function GET() {
  // Build the manifest in the official format
  const manifest = {
    accountAssociation: {
      header: "",
      payload: "",
      signature: ""
    },
    frame: {
      version: "next",
      name: "8BitMinter",
      iconUrl: "/logo.png",
      homeUrl: "https://8bitminter.vercel.app",
      splashImageUrl: "/logo.png",
      splashBackgroundColor: "#181028",
      primaryCategory: "art-creativity",
      description: "Create and mint your own 8-bit style tokens on the blockchain.",
      tags: ["nft", "tokens", "blockchain", "web3", "8bit"],
      screenshotUrls: [
        "/images/screenshot1.png"
      ],
      webhookUrl: "https://8bitminter.vercel.app/api/webhook"
    }
  };

  // Build response with correct headers
  const response = NextResponse.json(manifest);
  
  // Set cache control and content type headers
  response.headers.set('Content-Type', 'application/json');
  response.headers.set('Cache-Control', 'public, max-age=3600');
  
  return response;
} 