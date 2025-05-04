"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { http } from "wagmi";
import { farcasterFrame as miniAppConnector } from "@farcaster/frame-wagmi-connector";

// Improved Wagmi configuration for Farcaster mini-apps
const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors: [
    miniAppConnector()
  ]
});

export default function Providers({ children }: { children: React.ReactNode }) {
  // React Query client with improved configuration
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2, // Retry failed queries twice
        staleTime: 10 * 1000, // Consider data stale after 10 seconds
        refetchOnWindowFocus: false, // Don't refetch when window regains focus
      },
      mutations: {
        retry: 1, // Retry failed mutations once
      },
    },
  }));
  
  // Track whether we've mounted in the browser
  const [mounted, setMounted] = useState(false);

  // Only run on client-side
  useEffect(() => {
    setMounted(true);
    
    // Log wallet connection availability
    if (typeof window !== 'undefined') {
      console.log('Initializing wallet connection for Farcaster mini-app');
      
      // Listen for wallet connection errors
      window.addEventListener('error', (event) => {
        if (
          event.error?.message?.includes('wallet') || 
          event.error?.message?.includes('ethereum') ||
          event.error?.message?.includes('provider')
        ) {
          console.error('Wallet connection error:', event.error);
        }
      });
    }
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {mounted && children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
