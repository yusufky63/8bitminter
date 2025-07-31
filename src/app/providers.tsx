"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { http } from "wagmi";
import { farcasterFrame as miniAppConnector } from "@farcaster/frame-wagmi-connector";
import { injected } from 'wagmi/connectors';
import { FarcasterProvider } from '../lib/farcaster';

// Create Wagmi configuration for both Farcaster mini-apps and BaseApp
const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors: [
    // Farcaster connector for Warpcast/Farcaster apps
    miniAppConnector(),
    // Injected connector for BaseApp and browser wallets
    injected({
      target: 'metaMask',
    }),
  ]
});

export default function Providers({ children }: { children: React.ReactNode }) {
  // React Query client
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: 10 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));
  
  // Track whether we've mounted in the browser
  const [mounted, setMounted] = useState(false);

  // Only run on client-side
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <FarcasterProvider>
          {mounted ? children : null}
        </FarcasterProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
