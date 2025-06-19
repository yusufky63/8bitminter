import React, { useState, useEffect } from "react";
import Image from "next/image";
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
  isPurchaseEnabled: boolean;
  selectedPurchaseAmount: string;
  selectedPurchasePercentage: number;
  usdValue: string;
  isCustomAmount: boolean;
  ownersAddresses: string[];
  newOwnerAddress: string;
  isConnected: boolean;
  isLoading: boolean;
  selectedCurrency: number;
  onPurchaseToggle: () => void;
  onPercentageChange: (percentage: number) => void;
  onCustomAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNewOwnerAddressChange: (address: string) => void;
  onAddOwner: () => void;
  onRemoveOwner: (address: string) => void;
  onConnect: () => void;
  onCreateCoin: () => void;
  onBack: () => void;
  onCurrencyChange: (currency: number) => void;
}

export function RetroMint({
  name,
  symbol,
  description,
  displayImageUrl,
  isPurchaseEnabled,
  selectedPurchaseAmount,
  selectedPurchasePercentage,
  usdValue,
  isCustomAmount,
  ownersAddresses,
  newOwnerAddress,
  isConnected,
  isLoading,
  selectedCurrency,
  onPurchaseToggle,
  onPercentageChange,
  onCustomAmountChange,
  onNewOwnerAddressChange,
  onAddOwner,
  onRemoveOwner,
  onConnect,
  onCreateCoin,
  onBack,
  onCurrencyChange
}: RetroMintProps) {
  const isDisabled = !isConnected;
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  
  // Handle percentage button click
  const handlePercentageClick = (percentage: number) => {
    // Ensure we're in percentage mode
    setUseCustomAmount(false);
    
    // Update the percentage
    onPercentageChange(percentage);
  };
  
  // Toggle custom amount mode
  const toggleCustomAmount = () => {
    const newValue = !useCustomAmount;
    setUseCustomAmount(newValue);
    
    // If switching to percentage mode, trigger percentage change to update amount
    if (!newValue) {
      onPercentageChange(selectedPurchasePercentage);
    }
  };

  // Sync local state with parent state when needed
  useEffect(() => {
    setUseCustomAmount(isCustomAmount);
  }, [isCustomAmount]);

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
                src={resolveImageUrl(displayImageUrl)}
                alt="Token"
                width={96}
                height={96}
                className="w-full h-full object-cover pixelated"
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
     
        
        <RetroDivider text="CURRENCY SELECTION" />
        
        <div className="mb-4">
          <label className="retro-label mb-2">SELECT TRADING CURRENCY</label>
          <div className="grid grid-cols-2 gap-2">
            <RetroButton
              onClick={() => onCurrencyChange(2)} // ETH
              className={`text-sm ${selectedCurrency === 2 ? 'bg-retro-primary text-retro-dark' : 'bg-transparent border border-retro-primary text-retro-accent'}`}
            >
              ETH/WETH
            </RetroButton>
            
            <RetroButton
              onClick={() => onCurrencyChange(1)} // ZORA
                              className={`text-sm ${selectedCurrency === 1 ? 'bg-retro-primary text-retro-dark' : 'bg-transparent border border-retro-primary text-retro-accent'}`}
            >
              ZORA TOKEN
            </RetroButton>
          </div>
          
          <div className="text-xs text-retro-secondary mt-2 p-2 border border-retro-primary/30">
            <p className="mb-1">
              <span className="text-retro-primary">ETH/WETH:</span> Most common, uses Ethereum as trading currency
            </p>
            <p>
              <span className="text-retro-primary">ZORA TOKEN:</span> Uses ZORA tokens for trading
            </p>
          </div>
        </div>
        
        <RetroDivider text="PURCHASE SETTINGS" />
        
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="retro-label">INITIAL PURCHASE</label>
            
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isPurchaseEnabled}
                onChange={onPurchaseToggle}
              />
              <div className="relative w-11 h-6 bg-retro-dark border-2 border-retro-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[0.2rem] after:left-[0.2rem] after:bg-retro-primary after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
              <span className="ml-2 text-xs font-mono text-retro-accent">
                {isPurchaseEnabled ? "ENABLED" : "DISABLED"}
              </span>
            </label>
          </div>
          
          {isPurchaseEnabled && (
            <div className="mb-5">
              <div className="flex justify-between mb-2">
                <label className="font-mono text-xs text-retro-accent">INITIAL PURCHASE AMOUNT</label>
                <span className="font-mono text-xs text-retro-accent">≈ ${usdValue} USD</span>
              </div>
              
              {/* Input mode toggle */}
              <div className="flex items-center justify-end mb-2">
                <span className="text-xs font-mono text-retro-accent mr-2">
                  {useCustomAmount ? "CUSTOM AMOUNT" : "PERCENTAGE"}
                </span>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={useCustomAmount}
                    onChange={toggleCustomAmount}
                  />
                  <div className="relative w-9 h-5 bg-retro-dark border-2 border-retro-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[0.1rem] after:left-[0.1rem] after:bg-retro-primary after:border after:rounded-full after:h-3 after:w-3 after:transition-all"></div>
                </label>
              </div>
              
              {!useCustomAmount ? (
                <>
                  {/* Slider for percentage selection */}
                  <input
                    type="range"
                    min="1"
                    max="99"
                    value={selectedPurchasePercentage}
                    onChange={(e) => onPercentageChange(parseInt(e.target.value))}
                    className="retro-slider w-full mb-3"
                  />
                  
                  {/* Percentage buttons */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[10, 25, 50, 99].map((percent) => (
                      <RetroButton
                        key={percent}
                        onClick={() => handlePercentageClick(percent)}
                        className={`text-xs ${selectedPurchasePercentage === percent ? 'bg-retro-primary' : 'bg-transparent border border-retro-primary'}`}
                      >
                        {percent === 99 ? "Max" : `${percent}%`}
                      </RetroButton>
                    ))}
                  </div>
                </>
              ) : null}
              
              {/* ETH input field */}
              <div className="relative mb-1">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  className={`retro-input w-full pr-16 text-sm ${!useCustomAmount ? 'opacity-80' : ''}`}
                  value={selectedPurchaseAmount}
                  onChange={onCustomAmountChange}
                  disabled={!useCustomAmount}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-retro-primary font-mono bg-retro-dark px-1">
                  ETH
                </div>
              </div>
              
              <p className="text-xs text-retro-secondary mt-1 mb-4 font-mono">
                {useCustomAmount 
                  ? "* ENTER CUSTOM ETH AMOUNT FOR INITIAL LIQUIDITY" 
                  : "* PERCENTAGE OF YOUR ETH BALANCE FOR LIQUIDITY"}
              </p>
            </div>
          )}
        </div>
        
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
        
        {!isConnected ? (
          <RetroButton
            onClick={onConnect}
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
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              CONNECT WITH FARCASTER
            </span>
          </RetroButton>
        ) : (
          <RetroButton
            onClick={onCreateCoin}
            fullWidth
            isLoading={isLoading}
            disabled={isDisabled}
          >
            CREATE TOKEN
          </RetroButton>
        )}
      </div>
    </RetroStepScreen>
  );
} 