import { NextResponse } from 'next/server';

export async function GET() {
  // Get the base URL for the application
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://8bitminter.vercel.app';
  
  // Simple mini-app config without account association
  return NextResponse.json({
    frame: {
      version: "1",
      name: "8BitMinter",
      description: "Create retro-styled tokens on the blockchain with AI-generated art",
      imageUrl: `${baseUrl}/opengraph-image.png`,
      buttonTitle: "Create Token",
      homeUrl: baseUrl,
      iconUrl: `${baseUrl}/logo.png`,
      splashImageUrl: `${baseUrl}/logo.png`,
      splashBackgroundColor: "#181028"
    }
  });
} 