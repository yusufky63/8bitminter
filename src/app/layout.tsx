import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getSession } from "~/auth"
import "~/app/globals.css";
import { Providers } from "~/app/providers";

// Load Inter font
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_FRAME_NAME || "VisionZ Coin Creator",
  description: process.env.NEXT_PUBLIC_FRAME_DESCRIPTION || "Create AI-powered Zora coins with Farcaster",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {  
  const session = await getSession()

  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="bg-white text-foreground">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
