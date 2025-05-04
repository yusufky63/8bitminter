import { Metadata } from "next";
import App from "./app";

const appUrl = process.env.NEXT_PUBLIC_URL || "https://visionz-mini.vercel.app";

// frame preview metadata
const appName = process.env.NEXT_PUBLIC_FRAME_NAME || "Coin Creator";
const splashImageUrl = `${appUrl}/logo.png`;
const appDescription = process.env.NEXT_PUBLIC_FRAME_DESCRIPTION || "Create RETRO AI-powered tokens on Farcaster";
const buttonText = process.env.NEXT_PUBLIC_FRAME_BUTTON_TEXT || "Create Vision";

// Brand color for Farcaster - using our indigo-violet gradient
const brandColor = "#6366F1"; 

// Updated to match Farcaster Frame specification v1
const framePreviewMetadata = {
  version: "1",
  imageUrl: `${appUrl}/logo.png`,
  button: {
    title: buttonText,
    action: {
      type: "launch_frame",
      name: appName,
      url: appUrl,
      splashImageUrl: splashImageUrl,
      splashBackgroundColor: brandColor
    }
  }
};

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: appName,
    description: appDescription,
    openGraph: {
      title: appName,
      description: appDescription,
      images: [`${appUrl}/logo.png`],
    },
    other: {
      "fc:frame": JSON.stringify(framePreviewMetadata),
    },
  };
}

export default function Home() {
  return (<App />);
}
