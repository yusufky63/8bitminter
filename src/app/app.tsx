"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Loading component to show while CoinCreator is being loaded
const LoadingComponent = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);
LoadingComponent.displayName = 'LoadingComponent';

// Özel NoSSR wrapper bileşeni
function NoSSR({ children }: { children: React.ReactNode }) {
  return (
    <div suppressHydrationWarning>
      {typeof window === 'undefined' ? null : children}
    </div>
  )
}
NoSSR.displayName = 'NoSSR';

// Farcaster Frame SDK'yı kullanan bileşenler için daha iyi dinamik import yaklaşımı
const CoinCreator = dynamic(
  () => {
    console.log("[APP] Loading CoinCreator component dynamically...");
    // Önce SDK'yı browser-only olarak import etmeyi dene
    if (typeof window !== 'undefined') {
      // En iyi dynamicImport yaklaşımı
      return import("~/components/CoinCreator").catch(err => {
        console.error("[APP] Error dynamically importing CoinCreator:", err);
        const FallbackComponent = () => <div>Failed to load CoinCreator component</div>;
        FallbackComponent.displayName = 'CoinCreatorFallback';
        return FallbackComponent;
      });
    }
    // Sunucu tarafında boş bir bileşen döndür
    const EmptyComponent = () => null;
    EmptyComponent.displayName = 'EmptyCoinCreator';
    return Promise.resolve(EmptyComponent);
  },
  {
  ssr: false,
    loading: () => <LoadingComponent />
  }
);

export default function App() {
  return (
    <NoSSR>
      <Suspense fallback={<LoadingComponent />}>
        <CoinCreator />
      </Suspense>
    </NoSSR>
  );
}
