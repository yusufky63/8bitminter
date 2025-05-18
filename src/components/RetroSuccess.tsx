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

  // Go to coin details page
  const goToCoinDetails = () => {
    // Find the header component and trigger tab change to "explore"
    if (typeof window !== 'undefined') {
      // Add the contract to local storage so the Explore tab can show it
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
        
        // Find RetroHeader and trigger tab change to "explore" with the contract address
        const changeTabEvent = new CustomEvent('changeTab', { 
          detail: { tab: 'explore', contractAddress } 
        });
        window.dispatchEvent(changeTabEvent);
        
        // Navigate to coin details
        window.location.href = `/#explore/${contractAddress}`;
        
        // Reload the page to ensure tab change
        setTimeout(() => window.location.reload(), 100);
      } catch (error) {
        console.error("Failed to save token to localStorage:", error);
        // Fallback - just try to change tab
        window.location.href = `/#explore/${contractAddress}`;
      }
    }
  };

  return (
    <RetroStepScreen
      title="MISSION ACCOMPLISHED"
      hideButtons={true}
      className="mb-3"
    >
      <div className="crt-effect bg-retro-success/20 p-3 border-2 border-retro-success mb-5">
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
      
      <div className="mb-5">
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
          <details open className="mt-3 border border-retro-primary">
            <summary className="font-mono text-xs text-retro-primary bg-retro-dark p-1 cursor-pointer flex items-center">
              <span className="inline-block w-2 h-2 bg-retro-accent mr-1"></span>
              AI-GENERATED DESCRIPTION
            </summary>
            <div className="p-2 bg-retro-darker">
              <p className="text-xs font-mono text-retro-accent">{description}</p>
            </div>
          </details>
        </div>
      </div>
      
      <div className="flex gap-3">
        <RetroButton
          variant="outline"
          onClick={openOnZora}
          fullWidth
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="mr-2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          VIEW ON ZORA
        </RetroButton>
        
        <RetroButton
          onClick={goToCoinDetails}
          fullWidth
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="mr-2">
            <path d="M23 12l-7-7v4H8v6h8v4l7-7z"></path>
            <path d="M1 5v14h15"></path>
          </svg>
          TRADE
        </RetroButton>
      </div>
    </RetroStepScreen>
  );
} 