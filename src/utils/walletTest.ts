/**
 * Test script for wallet environment detection
 * This can be used to debug wallet integration issues
 */

import { detectEnvironment, getPreferredConnectorId, isWalletAvailable, getWalletAvailabilityMessage } from './wallet';

export function runWalletDiagnostics() {
  console.log('=== Wallet Diagnostics ===');
  
  const environment = detectEnvironment();
  const preferredConnector = getPreferredConnectorId(environment);
  const walletAvailable = isWalletAvailable();
  const message = getWalletAvailabilityMessage(environment);
  
  console.log('Environment:', environment);
  console.log('Preferred connector:', preferredConnector);
  console.log('Wallet available:', walletAvailable);
  console.log('Message:', message);
  
  // Additional browser info
  if (typeof window !== 'undefined') {
    console.log('User Agent:', window.navigator?.userAgent);
    console.log('Hostname:', window.location.hostname);
    console.log('Has ethereum:', typeof window.ethereum !== 'undefined');
    
    // Enhanced ethereum provider detection
    if (window.ethereum) {
      console.log('Ethereum providers:', {
        isMetaMask: window.ethereum.isMetaMask,
        isCoinbaseWallet: window.ethereum.isCoinbaseWallet,
        isBaseWallet: window.ethereum.isBaseWallet,
        providers: window.ethereum.providers?.length || 'single'
      });
    }
    
    // Farcaster context detection
    console.log('Farcaster context:', {
      hasFarcasterWindow: typeof (window as any).farcaster !== 'undefined',
      hasSDK: typeof (window as any).sdk !== 'undefined',
      isFrame: (window as any).top !== window,
      clientFid: (window as any).farcaster?.context?.client?.clientFid
    });
    
    // BaseApp detection
    console.log('BaseApp indicators:', {
      hasBaseApp: typeof (window as any).BaseApp !== 'undefined',
      coinbaseWallet: window.ethereum?.isCoinbaseWallet,
      baseInUA: window.navigator?.userAgent?.toLowerCase().includes('base'),
      coinbaseInUA: window.navigator?.userAgent?.toLowerCase().includes('coinbase')
    });
  }
  
  console.log('=========================');
}

export async function testWalletConnections() {
  console.log('=== Testing Wallet Connections ===');
  
  const environment = detectEnvironment();
  console.log('Testing environment:', environment);
  
  // Test BaseApp context
  if (environment === 'baseapp') {
    try {
      const { getBaseAppContext } = await import('./wallet');
      const baseAppContext = await getBaseAppContext();
      console.log('BaseApp context:', baseAppContext);
    } catch (error) {
      console.error('BaseApp context error:', error);
    }
  }
  
  // Test Farcaster context
  if (environment === 'farcaster' || environment === 'baseapp') {
    try {
      const { getFarcasterUserContext } = await import('./wallet');
      const farcasterContext = await getFarcasterUserContext();
      console.log('Farcaster context:', farcasterContext);
    } catch (error) {
      console.error('Farcaster context error:', error);
    }
  }
  
  console.log('===================================');
}

// Auto-run diagnostics in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  setTimeout(runWalletDiagnostics, 1000);
}