"use client";

import { sdk } from "@farcaster/frame-sdk";

/**
 * Bu dosya Warpcast dokümantasyonuna göre Mini App entegrasyonu içindir.
 * @see https://miniapps.farcaster.xyz/docs/guides/loading
 */

/**
 * Mini App'in hazır olduğunu bildir ve splash screen'i kapat
 */
export async function dismissSplashScreen() {
  try {
    // Dokümanda belirtildiği şekilde:
    await sdk.actions.ready();
  } catch (error) {
    console.error("Error calling ready method:", error);
  }
}

/**
 * Farcaster Mini App'in global olarak kullanılabilir olup olmadığını kontrol et
 */
export function isFarcasterMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  
  return !!(window.farcaster || 
    (typeof sdk !== "undefined" && sdk.actions && sdk.actions.ready));
}

/**
 * Mini App'i başlatma kodu
 */
export function initializeFarcaster() {
  if (typeof window === "undefined") return;
  
  // Dokümantasyon: Interface hazır olduğunda çağırın
  dismissSplashScreen();
} 