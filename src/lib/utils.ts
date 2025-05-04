import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { mnemonicToAccount } from 'viem/accounts';

interface FrameMetadata {
  accountAssociation?: {
    header: string;
    payload: string;
    signature: string;
  };
  frame: {
    version: string;
    name: string;
    iconUrl: string;
    homeUrl: string;
    imageUrl: string;
    buttonTitle: string;
    splashImageUrl: string;
    splashBackgroundColor: string;
    webhookUrl: string;
  };
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSecretEnvVars() {
  const seedPhrase = process.env.SEED_PHRASE;
  const fid = process.env.FID;
  
  if (!seedPhrase || !fid) {
    return null;
  }

  return { seedPhrase, fid };
}

export async function getFarcasterMetadata(): Promise<FrameMetadata> {
  // Return the exact same content as the static file
  return {
    accountAssociation: {
      header: "eyJmaWQiOjg2NDc5MywidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweENjZTJFMjI5NzNmMUY1MTA5MjQzQTZiNkREZTdBNDk4QzlENjYzNjYifQ",
      payload: "eyJkb21haW4iOiJ0YXgtdXN1YWxseS1hdXN0aW4tbGlzdGVuaW5nLnRyeWNsb3VkZmxhcmUuY29tIn0",
      signature: "MHhjODJhODNhMDhlYzhkMmNmZWJiMjRhNGZlMmUyOWRlNTY5OGU2NjYwYzEyMDA4MzQ4NTQxMmZlNjJlOGJjOGYyNzY0YTg0OWVmMWYxZmI0YjIzYmY2MDcxMzZkYjEzNDdkMWNkMjMyMzVhZTg1ZGJmZDZjODRhMzlhMDhkY2I4NDFj"
    },
    frame: {
      version: "1",
      name: "VisionZ Retro",
      iconUrl: `${process.env.NEXT_PUBLIC_URL || 'https://visionz-mini.vercel.app'}/logo.png`,
      imageUrl: `${process.env.NEXT_PUBLIC_URL || 'https://visionz-mini.vercel.app'}/opengraph-image.png`,
      buttonTitle: "Create Vision",
      homeUrl: process.env.NEXT_PUBLIC_URL || 'https://visionz-mini.vercel.app',
      splashImageUrl: `${process.env.NEXT_PUBLIC_URL || 'https://visionz-mini.vercel.app'}/logo.png`,
      splashBackgroundColor: "#000000",
      webhookUrl: `${process.env.NEXT_PUBLIC_URL || 'https://visionz-mini.vercel.app'}/api/webhook`
    },
  };
}
