import { Metadata } from "next";
import App from "./app";

const appUrl = process.env.NEXT_PUBLIC_URL || "https://visionz-mini.vercel.app";

// frame preview metadata
const appName = process.env.NEXT_PUBLIC_FRAME_NAME || "VisionZ Coin Creator";
const splashImageUrl = `${appUrl}/splash.png`;
const appDescription = process.env.NEXT_PUBLIC_FRAME_DESCRIPTION || "Create AI-powered Zora coins with Farcaster";
const buttonText = process.env.NEXT_PUBLIC_FRAME_BUTTON_TEXT || "Create Coin";

// Brand color for Farcaster - using our purple primary color
const brandColor = "#7C65C1"; 

// Updated to match Farcaster Frame specification v1
const framePreviewMetadata = {
  version: "1",
  imageUrl: `${appUrl}/opengraph-image`,
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
      images: [`${appUrl}/opengraph-image`],
    },
    other: {
      "fc:frame": JSON.stringify(framePreviewMetadata),
    },
  };
}

export default function Home() {
  return (<App />);
}
