"use client";

import dynamic from "next/dynamic";
import type { Session } from "next-auth"
import { SessionProvider } from "next-auth/react"

// FrameProvider ve WagmiProvider'ı sadece client tarafında yükle
const FrameProvider = dynamic(
  () => import("~/components/providers/FrameProvider").then(mod => ({ default: mod.FrameProvider })),
  { ssr: false }
);

const WagmiProvider = dynamic(
  () => import("~/components/providers/WagmiProvider"),
  { ssr: false }
);

export function Providers({ session, children }: { session: Session | null, children: React.ReactNode }) {
  return (
    <SessionProvider session={session}>
      <WagmiProvider>
        <FrameProvider>
          {children}
        </FrameProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}
