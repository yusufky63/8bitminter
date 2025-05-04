import React, { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from "wagmi";
import { toast } from "react-hot-toast";
import { getCoinDetails } from "../services/sdk/getCoins.js";
import { validateTradeBalance, checkETHBalance, checkTokenBalance, getTradeContractCallParams } from "../services/sdk/getTradeCoin.js";
import { formatUnits, parseUnits } from "ethers";
import { formatEther, parseEther } from "viem";
import { RetroButton } from "./ui/RetroButton";
import { RetroInput } from "./ui/RetroInput";

interface CoinDetailsProps {
  coinAddress?: string;
  onBack: () => void;
}

interface TokenDetails {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
  description?: string;
  creator: {
    address: string;
    profileName?: string;
  };
  imageUri?: string;
  marketCap?: string;
  volume24h?: string;
  totalVolume?: string;
  uniqueHolders?: number;
  createdAt?: string;
}

// Explicitly type the data from getCoinDetails API
interface CoinData {
  address: string;
  name: string;
  symbol: string;
  totalSupply?: string;
  description?: string;
  creatorAddress?: string;
  creator?: {
    address?: string;
    profileName?: string;
  };
  creatorProfile?: {
    handle?: string;
  };
  mediaContent?: {
    previewImage?: {
      medium?: string;
    }
  };
  tokenUri?: string;
  marketCap?: string;
  volume24h?: string;
  totalVolume?: string;
  uniqueHolders?: number;
  createdAt?: string;
}

// Define the validation result interface to handle type checking
interface ValidationResult {
  isValid: boolean;
  message: string;
  currentBalance: bigint;
  error?: Error;
}

// Add Viem-compatible type definition for contract parameters
interface ContractCallParams {
  to: `0x${string}`;  // Viem hex format
  data: `0x${string}`; // Viem hex format
  value?: bigint;
}

// Contract parameters interface for type safety
interface TradeContractParams {
  address: `0x${string}`;
  abi: any[];
  functionName: string;
  args: any[];
  value?: bigint;
}

export default function CoinDetails({ coinAddress, onBack }: CoinDetailsProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  // useWriteContract hook'unu kullan
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  
  const [isLoading, setIsLoading] = useState(true);
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [tradeAmount, setTradeAmount] = useState("0.01");
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [isTrading, setIsTrading] = useState(false);
  const [ethToUsdRate, setEthToUsdRate] = useState<number>(3000); // Default ETH price
  const [userEthBalance, setUserEthBalance] = useState<bigint>(BigInt(0));
  const [userTokenBalance, setUserTokenBalance] = useState<bigint>(BigInt(0));
  const [selectedPurchasePercentage, setSelectedPurchasePercentage] = useState<number>(10);
  const [isCustomAmount, setIsCustomAmount] = useState<boolean>(false);
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

  // Add a variable to track if the amount is valid
  const validAmount = tradeAmount && parseFloat(tradeAmount) > 0;

  // Fetch ETH price in USD
  const fetchEthPrice = useCallback(async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      if (data && data.ethereum && data.ethereum.usd) {
        setEthToUsdRate(data.ethereum.usd);
      }
    } catch (error) {
      console.error("Failed to fetch ETH price:", error);
      // Use fallback price if API fails
      setEthToUsdRate(3000);
    }
  }, []);

  // Update user balances
  const updateUserBalances = useCallback(async () => {
    if (isConnected && address && publicClient && tokenDetails) {
      try {
        // Get ETH balance
        const ethBalance = await checkETHBalance(address, publicClient);
        setUserEthBalance(ethBalance);
        
        // Get token balance if token details are available
        if (tokenDetails.address) {
          const tokenBalance = await checkTokenBalance(address, tokenDetails.address, publicClient);
          setUserTokenBalance(tokenBalance || BigInt(0));
        }
      } catch (error) {
        console.error("Failed to get user balances:", error);
      }
    }
  }, [isConnected, address, publicClient, tokenDetails]);

  // Calculate purchase amount based on percentage of balance
  const calculatePurchaseAmount = useCallback((percentage: number): string => {
    if (tradeType === 'buy') {
      if (userEthBalance === BigInt(0)) return "0.001";
      
      // Calculate percentage of ETH balance (leave some for gas)
      const maxUsableBalance = userEthBalance * BigInt(90) / BigInt(100); // Use max 90% of balance to leave gas
      const amount = maxUsableBalance * BigInt(percentage) / BigInt(100);
      
      // Convert to ETH (with 5 decimal places)
      const ethAmount = Number(amount) / 10**18;
      
      // Ensure minimum amount of 0.001 ETH
      const finalAmount = Math.max(ethAmount, 0.001);
      
      // Format to 5 decimal places max
      return finalAmount.toFixed(5);
    } else {
      // Sell logic - base on token balance
      if (userTokenBalance === BigInt(0)) return "0";
      
      const amount = userTokenBalance * BigInt(percentage) / BigInt(100);
      
      // Convert to decimal (assuming 18 decimals for the token)
      const tokenAmount = Number(amount) / 10**18;
      
      // Format to 5 decimal places max
      return tokenAmount.toFixed(5);
    }
  }, [userEthBalance, userTokenBalance, tradeType]);

  // Set predefined amount
  const setPredefinedAmount = (percentage: number) => {
    setSelectedPurchasePercentage(percentage);
    setIsCustomAmount(false);
    const newAmount = calculatePurchaseAmount(percentage);
    setTradeAmount(newAmount);
  };

  // Handle custom amount change
  const handleTradeAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTradeAmount(value);
    setIsCustomAmount(true);
  };

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setSelectedPurchasePercentage(value);
    setIsCustomAmount(false);
  };

  // Fetch token details
  useEffect(() => {
    const fetchTokenDetails = async () => {
      if (!coinAddress) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        const data = await getCoinDetails(coinAddress) as CoinData;
        
        if (data) {
          setTokenDetails({
            address: data.address,
            name: data.name,
            symbol: data.symbol,
            totalSupply: data.totalSupply || "0",
            description: data.description,
            creator: {
              address: data.creatorAddress || data.creator?.address || "Unknown",
              profileName: data.creator?.profileName || data.creatorProfile?.handle
            },
            imageUri: data.mediaContent?.previewImage?.medium || data.tokenUri,
            marketCap: data.marketCap,
            volume24h: data.volume24h,
            totalVolume: data.totalVolume,
            uniqueHolders: data.uniqueHolders,
            createdAt: data.createdAt
          });
        }
      } catch (error) {
        console.error("Error fetching token details:", error);
        toast.error("Failed to load token details");
      } finally {
        setIsLoading(false);
      }
    };
    
    if (coinAddress) {
      fetchTokenDetails();
    } else {
      setIsLoading(false);
    }
  }, [coinAddress, isConnected]);

  // Update balances and fetch ETH price
  useEffect(() => {
    if (tokenDetails) {
      fetchEthPrice();
      updateUserBalances();
    }
  }, [tokenDetails, updateUserBalances, fetchEthPrice]);

  // Update purchase amount when slider changes or trade type changes
  useEffect(() => {
    if (!isCustomAmount) {
      const newAmount = calculatePurchaseAmount(selectedPurchasePercentage);
      setTradeAmount(newAmount);
    }
  }, [selectedPurchasePercentage, calculatePurchaseAmount, isCustomAmount, tradeType]);

  // Handle trade type change with improved functionality
  const handleTradeTypeChange = (type: 'buy' | 'sell') => {
    // Only perform actions if the type is actually changing
    if (type !== tradeType) {
      setTradeType(type);
      setIsCustomAmount(false);
      
      // Reset to 10% by default when switching between buy/sell
      setSelectedPurchasePercentage(10);
      
      // Calculate the new amount based on selected percentage
      const newAmount = calculatePurchaseAmount(10);
      setTradeAmount(newAmount);
      
      console.log(`Switched to ${type} mode with amount: ${newAmount}`);
    }
  };

  // Handle trade click with proper implementation
  const handleTradeClick = async () => {
    if (!tokenDetails || !isConnected || !publicClient) {
      if (!isConnected) {
        toast.error("Please connect your wallet first");
      } else if (!publicClient) {
        toast.error("Public client not ready");
      }
      return;
    }
    
    if (isTrading || isWritePending) {
      return; // Prevent multiple submissions
    }
    
    try {
      setIsTrading(true);
      setTransactionStatus('pending');
      
      // Validate the trade parameters
      if (!tokenDetails.address || !address) {
        toast.error("Missing token or account information");
        setIsTrading(false);
        return;
      }
      
      // Parse amount as ETH value
      const amountValue = parseFloat(tradeAmount);
      if (isNaN(amountValue) || amountValue <= 0) {
        toast.error("Please enter a valid amount");
        setIsTrading(false);
        return;
      }
      
      // Convert to Wei format
      const amountInWei = parseEther(tradeAmount);
      
      console.log(`${tradeType} transaction amount:`, {
        amount: tradeAmount,
        amountInWei: amountInWei.toString(),
        token: tokenDetails.symbol
      });
      
      // Balance validation with proper typing
      const validation = await validateTradeBalance(
        address,
        tokenDetails.address,
        tradeType,
        amountInWei,
        publicClient
      ) as ValidationResult;
      
      if (!validation.isValid) {
        toast.error(validation.message);
        setIsTrading(false);
        return;
      }
      
      // Get trade parameters from Zora SDK with proper typing
      const tradeParams = getTradeContractCallParams(
        tradeType,
        tokenDetails.address,
        address,
        amountInWei,
        BigInt(0), // minAmountOut
        undefined // referrerAddress
      ) as TradeContractParams;
      
      console.log("Transaction parameters:", {
        address: tradeParams.address,
        functionName: tradeParams.functionName, 
        argsCount: tradeParams.args.length,
        args: tradeParams.args,
        value: tradeParams.value ? tradeParams.value.toString() : '0'
      });
      
      // Execute trade using writeContractAsync
      const hash = await writeContractAsync(tradeParams);
      
      console.log(`Transaction sent: ${hash}`);
      toast.success(`${tradeType === 'buy' ? 'Buy' : 'Sell'} transaction successfully sent!`);
      setTransactionStatus('success');
      
      // Refresh balances after successful transaction
      setTimeout(() => {
        updateUserBalances();
      }, 3000);
    } catch (error: unknown) {
      console.error("Transaction error:", error);
      
      // User rejection handling
      const err = error as { message?: string; code?: number };
      if (err.message?.includes("User rejected") || err.code === 4001) {
        toast.error("Transaction was cancelled");
        // Kullanıcı reddettiğinde işlem sonlandı, yeni istek göndermeyi engelle
        setTransactionStatus('idle');
      } else {
        toast.error(`${tradeType} transaction failed: ${err.message || 'Unknown error'}`);
        setTransactionStatus('error');
      }
    } finally {
      setIsTrading(false);
    }
  };

  // Format timestamp to a more readable date
  const formatDate = (timestamp: string) => {
    try {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch (e) {
      return timestamp;
    }
  };

  // Format balance for display
  const formatBalance = (balance: bigint, decimals: number = 18) => {
    try {
      const balanceNumber = Number(balance) / (10 ** decimals);
      
      // Format with abbreviations
      if (balanceNumber >= 1_000_000_000_000) { // Trillion
        return (balanceNumber / 1_000_000_000_000).toFixed(2) + 'T';
      } else if (balanceNumber >= 1_000_000_000) { // Billion
        return (balanceNumber / 1_000_000_000).toFixed(2) + 'B';
      } else if (balanceNumber >= 1_000_000) { // Million
        return (balanceNumber / 1_000_000).toFixed(2) + 'M';
      } else if (balanceNumber >= 1_000) { // Thousand
        return (balanceNumber / 1_000).toFixed(2) + 'K';
      } else if (balanceNumber < 0.001 && balanceNumber > 0) {
        return balanceNumber.toExponential(4);
      }
      
      // Regular format for smaller numbers
      return balanceNumber < 1 ? balanceNumber.toFixed(5) : balanceNumber.toFixed(2);
    } catch (e) {
      return "0";
    }
  };

  // Calculate USD value
  const calculateUsdValue = (ethAmount: string) => {
    try {
      const amount = parseFloat(ethAmount);
      if (isNaN(amount)) return "0.00";
      const usdValue = amount * ethToUsdRate;
      
      // Format with abbreviations
      if (usdValue >= 1_000_000_000) { // Billion
        return (usdValue / 1_000_000_000).toFixed(2) + 'B';
      } else if (usdValue >= 1_000_000) { // Million
        return (usdValue / 1_000_000).toFixed(2) + 'M';
      } else if (usdValue >= 1_000) { // Thousand
        return (usdValue / 1_000).toFixed(2) + 'K';
      }
      
      return usdValue.toFixed(2);
    } catch (e) {
      return "0.00";
    }
  };

  // Format numbers with abbreviations 
  const formatNumberWithAbbreviations = (num?: number | string): string => {
    if (num === undefined || num === null) return "N/A";
    
    // Convert to number if it's a string
    const value = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(value)) return "N/A";
    
    if (value >= 1_000_000_000_000) { // Trillion
      return (value / 1_000_000_000_000).toFixed(2) + 'T';
    } else if (value >= 1_000_000_000) { // Billion
      return (value / 1_000_000_000).toFixed(2) + 'B';
    } else if (value >= 1_000_000) { // Million
      return (value / 1_000_000).toFixed(2) + 'M';
    } else if (value >= 1_000) { // Thousand
      return (value / 1_000).toFixed(2) + 'K';
    } else if (value < 0.001 && value > 0) {
      return value.toExponential(4);
    }
    return value < 1 ? value.toFixed(4) : value.toFixed(2);
  };

  return (
    <div className="retro-container p-2 border-2 border-retro-primary  items-center">
      <div className="flex items-center mb-3 bg-gradient-to-r from-retro-primary/30 to-retro-primary/10 p-2  border border-retro-primary">
        <RetroButton onClick={onBack} variant="outline" className="mr-2 text-xs border-retro-primary hover:bg-retro-primary/20 transition-all">
          Back
        </RetroButton>
        <h2 className="retro-header text-sm text-retro-primary font-bold pixelated">{tokenDetails?.symbol || 'Token'} Details</h2>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center my-4">
          <div className="retro-loading">
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
      ) : tokenDetails ? (
        <div>
          {/* Token header section with enhanced styling */}
          <div className="mb-4 bg-gradient-to-b from-retro-primary/10 to-transparent p-3  border-2 border-retro-primary shadow-[0_0_12px_rgba(255,107,53,0.15)]">
            <div className="flex items-start gap-3">
              {tokenDetails.imageUri ? (
                <img 
                  src={tokenDetails.imageUri} 
                  alt={tokenDetails.name} 
                  className="w-16 h-16 rounded-md pixelated border-2 border-retro-primary object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.style.display = "none";
                    const parent = target.parentNode;
                    if (parent) {
                      const svgPlaceholder = document.createElement("div");
                      svgPlaceholder.className = "w-16 h-16 bg-retro-primary/5 flex items-center justify-center rounded-md border-2 border-retro-primary";
                      svgPlaceholder.innerHTML = `<span class="text-retro-primary text-2xl font-bold pixelated">${tokenDetails.symbol.charAt(0)}</span>`;
                      parent.appendChild(svgPlaceholder);
                    }
                  }}
                />
              ) : (
                <div className="w-16 h-16 bg-retro-primary/5 flex items-center justify-center rounded-md border-2 border-retro-primary">
                  <span className="text-retro-primary text-2xl font-bold pixelated">{tokenDetails.symbol.charAt(0)}</span>
                </div>
              )}
              
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-retro-primary mb-0.5 pixelated">{tokenDetails.name}</h3>
                    <div className="text-xs text-retro-accent mb-1  px-2 py-0.5 inline-block  border border-retro-primary">{tokenDetails.symbol}</div>
                  </div>
                  
                  {tokenDetails.createdAt && (
                    <div className="text-xs text-retro-secondary  px-2 py-0.5  border border-retro-primary">
                      {formatDate(tokenDetails.createdAt)}
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-retro-secondary truncate mt-1 font-mono  p-1  border border-retro-primary">
                  {tokenDetails.address}
                </div>
                
                {tokenDetails.creator.profileName && (
                  <div className="mt-2 flex items-center">
                    <span className="text-xs text-retro-secondary mr-1">Created by:</span>
                    <span className="text-xs text-retro-accent  px-2 py-0.5  border border-retro-primary">
                      @{tokenDetails.creator.profileName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Token stats in grid layout */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {tokenDetails.uniqueHolders && (
              <div className=" p-2  border-2 border-retro-primary  transition-all">
                <span className="text-retro-secondary text-xs font-bold block mb-1">HOLDERS</span>
                <span className="text-retro-accent text-sm font-mono">{formatNumberWithAbbreviations(tokenDetails.uniqueHolders)}</span>
              </div>
            )}
            {tokenDetails.marketCap && (
              <div className=" p-2  border-2 border-retro-primary  transition-all">
                <span className="text-retro-secondary text-xs font-bold block mb-1">MARKET CAP</span>
                <span className="text-retro-accent text-sm font-mono">${formatNumberWithAbbreviations(tokenDetails.marketCap)}</span>
              </div>
            )}
            {tokenDetails.volume24h && (
              <div className=" p-2  border-2 border-retro-primary  transition-all">
                <span className="text-retro-secondary text-xs font-bold block mb-1">24H VOLUME</span>
                <span className="text-retro-accent text-sm font-mono">${formatNumberWithAbbreviations(tokenDetails.volume24h)}</span>
              </div>
            )}
            {tokenDetails.totalSupply && (
              <div className=" p-2  border-2 border-retro-primary  transition-all">
                <span className="text-retro-secondary text-xs font-bold block mb-1">SUPPLY</span>
                <span className="text-retro-accent text-sm font-mono">{formatNumberWithAbbreviations(tokenDetails.totalSupply)}</span>
              </div>
            )}
          </div>
            
          {/* Description with better styling */}
          {tokenDetails.description && (
            <div className="mb-4 bg-black/20 p-3  border-2 border-retro-primary">
              <h4 className="font-bold text-retro-primary text-xs mb-2 pixelated flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                DESCRIPTION
              </h4>
              <p className="text-retro-accent whitespace-pre-line text-xs max-h-24 overflow-y-auto font-mono ">
                {tokenDetails.description}
              </p>
            </div>
          )}
          
          {/* Trading section with improved UI */}
          <div className="mt-5 mb-2">
            <div className="flex items-center bg-gradient-to-r from-retro-primary/30 to-retro-primary/10 p-2  border border-retro-primary mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 text-retro-accent">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              <h4 className="font-bold text-retro-primary text-xs pixelated">TRADE {tokenDetails.symbol}</h4>
            </div>
          
            {isConnected && (
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div className=" p-2  border border-retro-primary">
                  <span className="text-retro-secondary font-bold block mb-1">YOUR ETH:</span>
                  <span className="text-retro-accent font-mono">{formatBalance(userEthBalance)}</span>
                </div>
                <div className=" p-2  border border-retro-primary">
                  <span className="text-retro-secondary font-bold block mb-1">YOUR {tokenDetails.symbol}:</span>
                  <span className="text-retro-accent font-mono">{formatBalance(userTokenBalance)}</span>
                </div>
              </div>
            )}
            
            {/* Trade type buttons with improved UI */}
            <div className="flex gap-2 mb-4">
              <RetroButton 
                onClick={() => handleTradeTypeChange('buy')}
                variant={tradeType === 'buy' ? 'default' : 'outline'}
                className={`flex-1 text-xs py-2 transition-all duration-300 ${tradeType === 'buy' ? 'bg-retro-primary shadow-[0_0_10px_rgba(255,107,53,0.3)]' : 'bg-transparent border-retro-primary hover:bg-retro-primary/10'}`}
              >
                BUY {tokenDetails.symbol}
              </RetroButton>
              <RetroButton 
                onClick={() => handleTradeTypeChange('sell')}
                variant={tradeType === 'sell' ? 'default' : 'outline'}
                className={`flex-1 text-xs py-2 transition-all duration-300 ${tradeType === 'sell' ? 'bg-retro-primary shadow-[0_0_10px_rgba(255,107,53,0.3)]' : 'bg-transparent border-retro-primary hover:bg-retro-primary/10'}`}
              >
                SELL {tokenDetails.symbol}
              </RetroButton>
            </div>
            
            <div className=" p-3  border-2 border-retro-primary mb-4">
              <label className="retro-label block mb-2 text-xs text-retro-primary font-bold pixelated">
                {tradeType === 'buy' ? `ETH AMOUNT TO USE` : `${tokenDetails.symbol} AMOUNT TO SELL`}
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                className="retro-input w-full mb-2 text-xs py-2 border-2 border-retro-primary text-retro-accent bg-black/60"
                value={tradeAmount}
                onChange={handleTradeAmountChange}
              />
              <div className="text-xs text-retro-accent text-right mb-3 font-mono  p-1  border border-retro-primary">
                ≈ ${calculateUsdValue(tradeAmount)} USD
              </div>

              {/* Percentage buttons in flex layout */}
              <div className="grid grid-cols-4 gap-1 mb-3">
                {[10, 25, 50, 100].map((percent) => (
                  <RetroButton
                    key={percent}
                    onClick={() => setPredefinedAmount(percent)}
                    variant={selectedPurchasePercentage === percent && !isCustomAmount ? 'default' : 'outline'}
                    className={`text-xs py-1 transition-all ${selectedPurchasePercentage === percent && !isCustomAmount ? 'bg-retro-primary' : 'bg-transparent border-retro-primary hover:bg-retro-primary/20'}`}
                  >
                    {percent}%
                  </RetroButton>
                ))}
              </div>

              {/* Slider with enhanced styling */}
              <input
                type="range"
                min="1"
                max="100"
                value={selectedPurchasePercentage}
                onChange={handleSliderChange}
                className="w-full h-2 mb-3 appearance-none rounded-full bg-retro-primary/20 border-2 border-retro-primary"
                style={{
                  background: `linear-gradient(to right, var(--retro-primary) 0%, var(--retro-primary) ${selectedPurchasePercentage}%, rgba(255, 107, 53, 0.1) ${selectedPurchasePercentage}%, rgba(255, 107, 53, 0.1) 100%)`
                }}
              />
            </div>
            
            {isConnected ? (
              <RetroButton 
                onClick={handleTradeClick}
                isLoading={isTrading}
                fullWidth
                className="text-xs bg-retro-primary hover:bg-retro-primary/90 transition-all duration-300 shadow-[0_0_10px_rgba(255,107,53,0.3)] hover:shadow-[0_0_15px_rgba(255,107,53,0.4)] border-2 border-retro-primary/70 py-3 font-bold"
              >
                {tradeType === 'buy' ? `BUY ${tokenDetails.symbol} NOW` : `SELL ${tokenDetails.symbol} NOW`}
              </RetroButton>
            ) : (
              <div className="text-center p-3 border border-retro-primary  ">
                <p className="text-retro-secondary text-xs mb-2">Connect your wallet to trade this token</p>
                <div className="animate-pulse h-1 w-20 bg-retro-primary/30 mx-auto rounded"></div>
              </div>
            )}
            
            {/* Trading tips section */}
            <div className="text-xs text-retro-accent mt-4  p-3  border border-retro-primary">
              <div className="flex items-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 text-retro-primary">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p className="font-semibold text-retro-primary">TRADING TIPS:</p>
              </div>
              <ul className="ml-5 space-y-1 list-disc">
                <li>Use percentage buttons for quick amounts</li>
                <li>Always leave some ETH for gas fees</li>
                <li>Check your balances before trading</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center p-5 border-2 border-retro-primary  bg-black/70">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-retro-primary/70">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p className="text-retro-accent text-sm mb-3">Token not found or data unavailable.</p>
          <RetroButton onClick={onBack} className="text-xs bg-retro-primary hover:bg-retro-primary/90 transition-all duration-300 shadow-[0_0_6px_rgba(255,107,53,0.2)]">
            RETURN TO EXPLORE
          </RetroButton>
        </div>
      )}

      {/* Transaction retry button - Hata durumunda yeniden deneme butonu */}
      {transactionStatus === 'error' && (
        <div className="mt-4 flex justify-center">
          <RetroButton 
            onClick={() => {
              setTransactionStatus('idle');
              handleTradeClick();
            }}
            className="text-sm py-1 px-4 bg-retro-primary hover:bg-retro-primary/80"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
            Try Again
          </RetroButton>
        </div>
      )}
    </div>
  );
} 