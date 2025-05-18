"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
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

// NoSSR wrapper component
function NoSSR({ children }: { children: React.ReactNode }) {
  return (
    <div suppressHydrationWarning>
      {typeof window === 'undefined' ? null : children}
    </div>
  )
}
NoSSR.displayName = 'NoSSR';

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

// Top level app component
export default function App() {
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState("create");
  const [isLoading, setIsLoading] = useState(true);

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true);
    console.log('[APP] App component mounted, client-side rendering enabled');
    
    // Delay setting isLoading to false to prevent flickering
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    
    if (typeof window !== 'undefined') {
      // Tab değişimlerini dinle
      const handleTabChangeEvent = (event: CustomEvent) => {
        if (event.detail && event.detail.tab) {
          setActiveTab(event.detail.tab);
        }
      };
      
      window.addEventListener('changeTab', handleTabChangeEvent as EventListener);
      
      return () => {
        window.removeEventListener('changeTab', handleTabChangeEvent as EventListener);
        clearTimeout(timer);
      };
    }
    
    return () => clearTimeout(timer);
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // SSR durumunda hiçbir şey render etme
  if (!isClient) {
    return null;
  }

  // Show loading screen while components are initializing
  if (isLoading) {
    return <LoadingComponent />;
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
    <NoSSR>
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
    </NoSSR>
  );
}
