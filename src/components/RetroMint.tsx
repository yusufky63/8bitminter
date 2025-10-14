import React, { useState, useEffect } from "react";
import Image from "next/image";
import { SafeImage } from "./ui/SafeImage";
import { RetroStepScreen } from "./RetroStepScreen";
import { RetroDivider } from "./RetroDivider";
import { RetroButton } from "./ui/RetroButton";
import { resolveImageUrl } from "../utils/ipfs";

interface RetroMintProps {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  displayImageUrl: string;
  // Removed purchase parameters - no longer supported in SDK v2
  ownersAddresses: string[];
  newOwnerAddress: string;
  isConnected: boolean;
  isLoading: boolean;
  isWalletReady?: boolean;
  selectedCurrency: string;
  onNewOwnerAddressChange: (address: string) => void;
  onAddOwner: () => void;
  onRemoveOwner: (address: string) => void;
  onConnect: () => void;
  onCreateCoin: () => void;
  onBack: () => void;
  onCurrencyChange: (currency: string) => void;
}

export function RetroMint({
  name,
  symbol,
  description,
  displayImageUrl,
  // Removed purchase parameters - no longer supported in SDK v2
  ownersAddresses,
  newOwnerAddress,
  isConnected,
  isLoading,
  isWalletReady = false,
  selectedCurrency,
  onNewOwnerAddressChange,
  onAddOwner,
  onRemoveOwner,
  onConnect,
  onCreateCoin,
  onBack,
  onCurrencyChange
}: RetroMintProps) {
  const isDisabled = !isWalletReady;

  // Primary action: if wallet is not ready, trigger connect; else create coin
  const handlePrimaryAction = () => {
    if (isWalletReady) {
      onCreateCoin();
    } else {
      onConnect();
    }
  };

  return (
    <RetroStepScreen
      title="CREATE YOUR TOKEN"
      hideButtons={true}
      className="mb-3"
    >
      <div className="mb-5">
        <RetroDivider text="TOKEN PREVIEW" />
        
        <div className="flex items-center mb-4">
            <div className="w-24 h-24 border-2 border-retro-primary mr-4">
            {displayImageUrl && resolveImageUrl(displayImageUrl) ? (
              <Image
                src={`/api/ipfs/proxy?u=${encodeURIComponent(resolveImageUrl(displayImageUrl))}`}
                alt="Token"
                width={96}
                height={96}
                className="w-full h-full object-cover pixelated"
                unoptimized
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentNode as HTMLElement;
                  if (parent) {
                    parent.innerHTML = '<div class="w-full h-full bg-retro-darker/50 flex items-center justify-center"><div class="text-center"><div class="text-retro-primary text-lg mb-1">📷</div><div class="text-retro-secondary text-xs">NO IMAGE</div></div></div>';
                  }
                }}
              />
            ) : (
              <div className="w-full h-full bg-retro-darker/50 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-retro-primary text-lg mb-1">📷</div>
                  <div className="text-retro-secondary text-xs">NO IMAGE</div>
                </div>
            </div>
          )}
          </div>
          
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-1 text-sm font-mono">
              <div className="text-retro-primary">NAME:</div>
              <div className="text-retro-accent">{name}</div>
              
              <div className="text-retro-primary">SYMBOL:</div>
              <div className="text-retro-accent">{symbol}</div>

              <div className="text-retro-primary">DESCRIPTION:</div>
              <div className="text-retro-accent text-xs">{description}</div>
            </div>
          </div>
        </div>

        {/* Add description section */}
     
        
        {/* Currency selection removed per requirements; default currency is used */}
        
        {/* Removed purchase settings - no longer supported in SDK v2 */}
        
        <RetroDivider text="CO-OWNERS (OPTIONAL)" />
        
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="font-mono text-xs text-retro-accent">ADDITIONAL OWNER ADDRESSES</label>
            <div className="text-xs text-retro-secondary font-mono">{ownersAddresses.length} ADDRESS(ES)</div>
          </div>
          
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              className="retro-input flex-1 text-sm"
              placeholder="0x..."
              value={newOwnerAddress}
              onChange={(e) => onNewOwnerAddressChange(e.target.value)}
            />
            <RetroButton
              onClick={onAddOwner}
              className="text-xs px-2"
              disabled={!newOwnerAddress}
            >
              ADD
            </RetroButton>
          </div>
          
          {ownersAddresses.length > 0 && (
            <div className="space-y-2 mb-3">
              {ownersAddresses.map((address, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-retro-dark border border-retro-primary">
                  <span className="text-xs font-mono text-retro-accent truncate max-w-[200px]">{address}</span>
                  <button
                    onClick={() => onRemoveOwner(address)}
                    className="text-retro-error"
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
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex gap-3">
        <RetroButton
          variant="outline"
          onClick={onBack}
          fullWidth
        >
          <span className="flex items-center justify-center">
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
              className="mr-2"
            >
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
            BACK
          </span>
        </RetroButton>
        
        <RetroButton
          onClick={handlePrimaryAction}
          fullWidth
          isLoading={isLoading}
          disabled={isLoading}
        >
          CREATE COIN
        </RetroButton>
      </div>
    </RetroStepScreen>
  );
} 
