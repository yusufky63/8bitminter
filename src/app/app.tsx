"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Loading component to show while CoinCreator is being loaded
const LoadingComponent = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

// Özel NoSSR wrapper bileşeni
function NoSSR({ children }: { children: React.ReactNode }) {
  return (
    <div suppressHydrationWarning>
      {typeof window === 'undefined' ? null : children}
    </div>
  )
}

// Farcaster Frame SDK'yı kullanan bileşenler için daha iyi dinamik import yaklaşımı
const CoinCreator = dynamic(
  () => {
    console.log("[APP] Loading CoinCreator component dynamically...");
    // Önce SDK'yı browser-only olarak import etmeyi dene
    if (typeof window !== 'undefined') {
      // En iyi dynamicImport yaklaşımı
      return import("~/components/CoinCreator").catch(err => {
        console.error("[APP] Error dynamically importing CoinCreator:", err);
        return () => <div>Failed to load CoinCreator component</div>;
      });
    }
    // Sunucu tarafında boş bir bileşen döndür
    return Promise.resolve(() => null);
  },
  {
    ssr: false,
    loading: () => <LoadingComponent />
  }
);

export default function App(
  { title }: { title?: string } = { title: process.env.NEXT_PUBLIC_FRAME_NAME || "VisionZ Coin Creator" }
) {
  return (
    <NoSSR>
      <Suspense fallback={<LoadingComponent />}>
        <CoinCreator />
      </Suspense>
    </NoSSR>
  );
}
