"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import RetroCoinCreator from "../components/RetroCoinCreator";
import RetroHeader from "../components/Header";

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
const CoinCreatorDynamic = dynamic(
  () => {
    console.log("[APP] Loading RetroCoinCreator component dynamically...");
    // Önce SDK'yı browser-only olarak import etmeyi dene
    if (typeof window !== 'undefined') {
      // En iyi dynamicImport yaklaşımı
      return import("../components/RetroCoinCreator").catch(err => {
        console.error("[APP] Error dynamically importing RetroCoinCreator:", err);
        const FallbackComponent = () => <div>Failed to load RetroCoinCreator component</div>;
        FallbackComponent.displayName = 'CoinCreatorFallback';
        return { default: FallbackComponent };
      });
    }
    // Sunucu tarafında boş bir bileşen döndür
    const EmptyComponent = () => null;
    EmptyComponent.displayName = 'EmptyCoinCreator';
    return Promise.resolve({ default: EmptyComponent });
  },
  {
    ssr: false,
    loading: () => <LoadingComponent />
  }
);

// Create dynamic import for new components
const CoinHolderView = dynamic(
  () => import("../components/CoinHolderView").catch(err => {
    console.error("[APP] Error importing CoinHolderView:", err);
    const FallbackComponent = () => (
      <div className="retro-container p-4">
        <h2 className="retro-header text-lg mb-4">Your Holdings</h2>
        <p className="text-retro-accent">Connect your wallet to view your token holdings.</p>
      </div>
    );
    return { default: FallbackComponent };
  }),
  { ssr: false, loading: () => <LoadingComponent /> }
);

const CoinExplorer = dynamic(
  () => import("../components/RetroCoinExplorer").catch(err => {
    console.error("[APP] Error importing CoinExplorer:", err);
    const FallbackComponent = () => (
      <div className="retro-container p-4">
        <h2 className="retro-header text-lg mb-4">Explore Tokens</h2>
        <p className="text-retro-accent">Discover and trade tokens on the platform.</p>
      </div>
    );
    return { default: FallbackComponent };
  }),
  { ssr: false, loading: () => <LoadingComponent /> }
);

export default function App() {
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState("create");

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  if (!isClient) {
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "create":
        return <RetroCoinCreator />;
      case "hold":
        return <CoinHolderView />;
      case "explore":
        return <CoinExplorer />;
      default:
        return <RetroCoinCreator />;
    }
  };

  return (
    <main className="bg-retro-darker min-h-screen py-2 retro-scanline">
      <div className="mx-auto max-w-2xl px-2">
        <RetroHeader activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="container mx-auto">
          {renderContent()}
        </div>
      </div>
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--retro-darker)',
            color: 'var(--retro-accent)',
            fontFamily: 'var(--body-font)',
            border: '1px solid var(--retro-primary)',
            boxShadow: '2px 2px 0 rgba(0, 0, 0, 0.2)',
            fontSize: '0.75rem',
            padding: '0.5rem'
          },
          success: {
            iconTheme: {
              primary: 'var(--retro-success)',
              secondary: 'var(--retro-darker)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--retro-error)',
              secondary: 'var(--retro-darker)',
            },
          },
          duration: 3000,
          id: 'unique-toast',
        }}
        gutter={4}
        containerStyle={{
          top: 20,
        }}
        containerClassName="retro-toasts"
      />
    </main>
  );
}
