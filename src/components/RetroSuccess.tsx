import React from "react";
import Image from "next/image";
import { RetroStepScreen } from "./RetroStepScreen";
import { RetroDivider } from "./RetroDivider";
import { RetroButton } from "./ui/RetroButton";


interface RetroSuccessProps {
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  description: string;
  displayImageUrl: string;
  onViewOnBasescan: () => void;
  onCreateAnother: () => void;
}

export function RetroSuccess({
  contractAddress,
  tokenName,
  tokenSymbol,
  description,
  displayImageUrl,
}: RetroSuccessProps) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(contractAddress);
  };

  // Open coin on Zora
  const openOnZora = () => {
    window.open(`https://zora.co/coin/${contractAddress}`, '_blank');
  };

  // Share on Warpcast
  const shareOnWarpcast = async () => {
    try {
      // Create share text with token details and links - now with mini app link
      const shareText = `I just created ${tokenName} (${tokenSymbol}) on Base network using 8BitCoiner! 🚀\n\n${description}\n\nView on Zora: https://zora.co/coin/${contractAddress}\n\nCreate your own: https://warpcast.com/miniapps/VJFTWn45l8cA/8bitminter`;
      
      // Try to use dynamic import to get the SDK if in browser
      if (typeof window !== 'undefined') {
        try {
          // Try to import the SDK dynamically
          const { sdk } = await import('@farcaster/frame-sdk');
          
          // Use the SDK to compose a cast if available
          if (sdk?.actions && 'composeCast' in sdk.actions) {
            // @ts-ignore - we're checking for existence first, so this is safe
            await sdk.actions.composeCast({ text: shareText });
            console.log("Opened share dialog in Warpcast with SDK");
            return;
          }
        } catch (importError) {
          console.log("Failed to import Farcaster SDK, falling back to window.farcaster", importError);
        }
        
        // Fall back to window.farcaster
        if (window.farcaster?.actions && 'composeCast' in window.farcaster.actions) {
          // @ts-ignore - we're checking for existence first, so this is safe
          await window.farcaster.actions.composeCast({ text: shareText });
          console.log("Opened share dialog using window.farcaster");
          return;
        }
      }
      
      // Direct URL fallback if not in Warpcast environment
      window.open(`https://farcaster.com/~/compose?text=${encodeURIComponent(shareText)}`, '_blank');
    } catch (error) {
      console.error("Error sharing to Warpcast:", error);
      // Fallback to copy to clipboard - also updated with mini app link
      navigator.clipboard.writeText(`I just created ${tokenName} (${tokenSymbol}) on Base network using 8BitCoiner! 🚀\n\n${description}\n\nView on Zora: https://zora.co/coin/${contractAddress}\n\nCreate your own: https://warpcast.com/miniapps/VJFTWn45l8cA/8bitminter`);
      alert("Share text copied to clipboard. You can paste it in Warpcast.");
    }
  };

  // Go to coin details page - fixed implementation to navigate to HOLD tab
  const goToCoinDetails = () => {
    if (typeof window !== 'undefined') {
      try {
        // Get existing watched tokens or initialize empty array
        const watchedTokens = JSON.parse(localStorage.getItem('watchedTokens') || '[]');
        
        // Add this token if it doesn't exist
        if (!watchedTokens.some((token: any) => token.address === contractAddress)) {
          watchedTokens.push({
            address: contractAddress,
            name: tokenName,
            symbol: tokenSymbol,
            icon: displayImageUrl
          });
          
          // Save back to localStorage
          localStorage.setItem('watchedTokens', JSON.stringify(watchedTokens));
        }
        
        // Store the token details in sessionStorage
        sessionStorage.setItem('viewTokenAddress', contractAddress);
        sessionStorage.setItem('viewTokenDetails', 'true');
        
        // Dispatch an event that the CoinHolderView can listen for
        window.dispatchEvent(new CustomEvent('viewCoinDetails', {
          detail: { tokenAddress: contractAddress }
        }));
        
        // Change the hash to include the token address
        window.location.hash = `hold?token=${contractAddress}`;
        
        // Manually navigate without a full page reload if possible
        const holdTabEvent = new CustomEvent('changeTab', {
          detail: { tab: 'hold' }
        });
        window.dispatchEvent(holdTabEvent);
      } catch (error) {
        console.error("Failed to navigate to hold view:", error);
        // Fallback - just try to navigate directly with hash and token parameter
        window.location.href = `/#hold?token=${contractAddress}`;
      }
    }
  };

  return (
    <RetroStepScreen
      title="MISSION ACCOMPLISHED"
      hideButtons={true}
      className="mb-3"
    >
      <div className="crt-effect bg-retro-success/20 p-3 border-2 border-retro-success mb-2">
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
            className="text-retro-success mr-2"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <div className="font-mono text-retro-success">
            TOKEN CREATED SUCCESSFULLY
          </div>
        </div>
      </div>
      
      <RetroDivider text="CONTRACT INFO" />
      
      <div className="mb-2">
        <div className="text-xs font-mono text-retro-primary mb-1">
          CONTRACT ADDRESS:
        </div>
        <div className="flex items-center bg-retro-dark p-2 border border-retro-primary">
          <code className="text-xs font-mono text-retro-accent flex-1 overflow-x-auto">
            {contractAddress}
          </code>
          <button
            onClick={copyToClipboard}
            className="ml-2 bg-retro-dark hover:bg-retro-darker p-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
              strokeLinejoin="miter"
              className="text-retro-primary"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="flex items-center border border-retro-primary p-3 mb-6">
        {displayImageUrl && (
          <div className="mr-4">
            <div className="w-24 h-24 border-2 border-retro-primary">
              <Image
                src={displayImageUrl}
                alt="Token"
                width={96}
                height={96}
                className="w-full h-full object-cover pixelated"
                unoptimized={true}
              />
            </div>
          </div>
        )}
        
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-1 text-sm font-mono">
            <div className="text-retro-primary">NAME:</div>
            <div className="text-retro-accent">{tokenName}</div>
            
            <div className="text-retro-primary">SYMBOL:</div>
            <div className="text-retro-accent">{tokenSymbol}</div>
          </div>
          
          {/* Display description */}
            <summary className="font-mono text-xs text-retro-primary bg-retro-dark cursor-pointer flex items-center">
              DESCRIPTION
            </summary>
            <div className="p-2 bg-retro-darker">
              <p className="text-xs font-mono text-retro-accent">{description}</p>
            </div>
        </div>
      </div>
      
      {/* Buttons section - now with 3 buttons in a grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <RetroButton
          variant="outline"
          onClick={openOnZora}
          fullWidth
        >
         
          VIEW ON ZORA
        </RetroButton>
        
        <RetroButton
          onClick={goToCoinDetails}
          fullWidth
        >
          
          HOLD & TRADE
        </RetroButton>
      </div>

      {/* Share on Warpcast button spans full width */}
      <RetroButton
        onClick={shareOnWarpcast}
        variant="default"
        fullWidth
        className="bg-purple-600 hover:bg-purple-700 border-purple-500 flex justify-center" 
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="mr-2">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
        SHARE ON FARCASTER
      </RetroButton>
    </RetroStepScreen>
  );
} 