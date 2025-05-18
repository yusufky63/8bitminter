import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { toast } from "react-hot-toast";
import { getCoinDetails } from "../services/sdk/getCoins.js";
import {
  validateTradeBalance,
  checkETHBalance,
  checkTokenBalance,
  getTradeContractCallParams,
} from "../services/sdk/getTradeCoin.js";
import { parseEther } from "viem";
import { RetroButton } from "./ui/RetroButton";

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
    };
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

// Contract parameters interface for type safety
interface TradeContractParams {
  address: `0x${string}`;
  abi: readonly {
    name: string;
    type: string;
    inputs?: readonly { name: string; type: string; internalType?: string }[];
    outputs?: readonly { name: string; type: string; internalType?: string }[];
    stateMutability?: string;
  }[];
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
}

export default function CoinDetails({ coinAddress, onBack }: CoinDetailsProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  // useWriteContract hook'unu kullan
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const [isLoading, setIsLoading] = useState(true);
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [tradeAmount, setTradeAmount] = useState("0.01");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [isTrading, setIsTrading] = useState(false);
  const [ethToUsdRate, setEthToUsdRate] = useState<number>(3000); // Default ETH price
  const [userEthBalance, setUserEthBalance] = useState<bigint>(BigInt(0));
  const [userTokenBalance, setUserTokenBalance] = useState<bigint>(BigInt(0));
  const [selectedPurchasePercentage, setSelectedPurchasePercentage] =
    useState<number>(10);
  const [isCustomAmount, setIsCustomAmount] = useState<boolean>(false);
  const [transactionStatus, setTransactionStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");

  // Add a variable to track if the amount is valid

  // Fetch ETH price in USD
  const fetchEthPrice = useCallback(async () => {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
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
          const tokenBalance = await checkTokenBalance(
            address,
            tokenDetails.address,
            publicClient
          );
          setUserTokenBalance(tokenBalance || BigInt(0));
        }
      } catch (error) {
        console.error("Failed to get user balances:", error);
      }
    }
  }, [isConnected, address, publicClient, tokenDetails]);

  // Calculate purchase amount based on percentage of balance
  const calculatePurchaseAmount = useCallback(
    (percentage: number): string => {
      if (tradeType === "buy") {
        if (userEthBalance === BigInt(0)) return "0.001";

        // Calculate percentage of ETH balance (leave some for gas)
        const maxUsableBalance = (userEthBalance * BigInt(95)) / BigInt(100); // Use max 95% of balance to leave gas
        const amount = (maxUsableBalance * BigInt(percentage)) / BigInt(100);

        // Convert to ETH (with 5 decimal places)
        const ethAmount = Number(amount) / 10 ** 18;

        // Ensure minimum amount of 0.001 ETH
        const finalAmount = Math.max(ethAmount, 0.001);

        // Format to 5 decimal places max
        return finalAmount.toFixed(5);
      } else {
        // Sell logic - base on token balance
        if (userTokenBalance === BigInt(0)) return "0";

        // Get token balance in human-readable form
        const tokenBalanceNumber = Number(userTokenBalance) / 10 ** 18;

        // For very small token balances, use a higher percentage to show a meaningful amount
        let adjustedPercentage = percentage;
        if (tokenBalanceNumber < 0.1) {
          adjustedPercentage = Math.max(percentage, 50); // Use at least 50% for small balances
        }

        // For max percentage (100%), use 99% to leave some tokens
        if (adjustedPercentage >= 99) {
          adjustedPercentage = 99;
        }

        // Calculate the amount based on percentage of token balance
        const amount = tokenBalanceNumber * (adjustedPercentage / 100);

        // If the token balance is very large, cap it at a reasonable maximum
        const MAX_TOKEN_AMOUNT = 1000000; // 1 million tokens max
        const limitedAmount = Math.min(amount, MAX_TOKEN_AMOUNT);

        // Format appropriately
        if (limitedAmount < 0.00001) {
          return limitedAmount.toExponential(5);
        } else if (limitedAmount < 0.001) {
          return limitedAmount.toFixed(6);
        } else if (limitedAmount < 1) {
          return limitedAmount.toFixed(5);
        } else {
          return limitedAmount.toFixed(2);
        }
      }
    },
    [userEthBalance, userTokenBalance, tradeType]
  );

  // Set predefined amount
  const setPredefinedAmount = (percentage: number) => {
    setSelectedPurchasePercentage(percentage);
    setIsCustomAmount(false);

    if (tradeType === "buy") {
      // For buy, calculate percentage of ETH balance
      const newAmount = calculatePurchaseAmount(percentage);
      setTradeAmount(newAmount);
    } else {
      // For sell, calculate percentage of token balance
      const tokenBalanceNumber = Number(userTokenBalance) / 10 ** 18;
      const tokenAmountToSell = tokenBalanceNumber * (percentage / 100);

      // Format the token amount appropriately
      let formattedAmount = tokenAmountToSell.toString();
      if (tokenAmountToSell < 0.00001) {
        formattedAmount = tokenAmountToSell.toExponential(5);
      } else if (tokenAmountToSell < 0.001) {
        formattedAmount = tokenAmountToSell.toFixed(6);
      } else if (tokenAmountToSell < 1) {
        formattedAmount = tokenAmountToSell.toFixed(5);
      } else {
        formattedAmount = tokenAmountToSell.toFixed(2);
      }

      setTradeAmount(formattedAmount);
      console.log(
        `Set sell amount to ${percentage}% of token balance: ${formattedAmount} ${tokenDetails?.symbol}`
      );
    }
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

    // Update the amount based on the slider position
    if (tradeType === "buy") {
      // For buy, calculate percentage of ETH balance
      const newAmount = calculatePurchaseAmount(value);
      setTradeAmount(newAmount);
    } else {
      // For sell, calculate percentage of token balance
      const tokenBalanceNumber = Number(userTokenBalance) / 10 ** 18;
      const tokenAmountToSell = tokenBalanceNumber * (value / 100);

      // Format the token amount appropriately
      let formattedAmount = tokenAmountToSell.toString();
      if (tokenAmountToSell < 0.00001) {
        formattedAmount = tokenAmountToSell.toExponential(5);
      } else if (tokenAmountToSell < 0.001) {
        formattedAmount = tokenAmountToSell.toFixed(6);
      } else if (tokenAmountToSell < 1) {
        formattedAmount = tokenAmountToSell.toFixed(5);
      } else {
        formattedAmount = tokenAmountToSell.toFixed(2);
      }

      setTradeAmount(formattedAmount);
    }
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
        const data = (await getCoinDetails(coinAddress)) as CoinData;

        if (data) {
          setTokenDetails({
            address: data.address,
            name: data.name,
            symbol: data.symbol,
            totalSupply: data.totalSupply || "0",
            description: data.description,
            creator: {
              address:
                data.creatorAddress || data.creator?.address || "Unknown",
              profileName:
                data.creator?.profileName || data.creatorProfile?.handle,
            },
            imageUri: data.mediaContent?.previewImage?.medium || data.tokenUri,
            marketCap: data.marketCap,
            volume24h: data.volume24h,
            totalVolume: data.totalVolume,
            uniqueHolders: data.uniqueHolders,
            createdAt: data.createdAt,
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
      if (tradeType === "buy") {
        // For buy, use calculatePurchaseAmount
        const newAmount = calculatePurchaseAmount(selectedPurchasePercentage);
        setTradeAmount(newAmount);
      } else {
        // For sell, calculate directly from token balance
        const tokenBalanceNumber = Number(userTokenBalance) / 10 ** 18;
        const tokenAmountToSell =
          tokenBalanceNumber * (selectedPurchasePercentage / 100);

        // Format the token amount appropriately
        let formattedAmount = tokenAmountToSell.toString();
        if (tokenAmountToSell < 0.00001) {
          formattedAmount = tokenAmountToSell.toExponential(5);
        } else if (tokenAmountToSell < 0.001) {
          formattedAmount = tokenAmountToSell.toFixed(6);
        } else if (tokenAmountToSell < 1) {
          formattedAmount = tokenAmountToSell.toFixed(5);
        } else {
          formattedAmount = tokenAmountToSell.toFixed(2);
        }

        setTradeAmount(formattedAmount);
      }
    }
  }, [
    selectedPurchasePercentage,
    calculatePurchaseAmount,
    isCustomAmount,
    tradeType,
    userTokenBalance,
  ]);

  // Handle trade type change with improved functionality
  const handleTradeTypeChange = (type: "buy" | "sell") => {
    // Only perform actions if the type is actually changing
    if (type !== tradeType) {
      setTradeType(type);
      setIsCustomAmount(false);

      // Reset to a more appropriate percentage depending on trade type
      if (type === "buy") {
        // For buy, use 10% of ETH balance
        setSelectedPurchasePercentage(10);

        // Calculate the new amount based on 10% of ETH balance
        const newAmount = calculatePurchaseAmount(10);
        setTradeAmount(newAmount);
      } else {
        // For sell mode, use the full token balance by default
        // Format the token balance for display
        const tokenBalanceNumber = Number(userTokenBalance) / 10 ** 18;

        // Use full token balance (99%) for sell by default
        setSelectedPurchasePercentage(99);

        // Format the token balance appropriately
        let formattedBalance = tokenBalanceNumber.toString();
        if (tokenBalanceNumber < 0.00001) {
          formattedBalance = tokenBalanceNumber.toExponential(5);
        } else if (tokenBalanceNumber < 0.001) {
          formattedBalance = tokenBalanceNumber.toFixed(6);
        } else if (tokenBalanceNumber < 1) {
          formattedBalance = tokenBalanceNumber.toFixed(5);
        } else {
          formattedBalance = tokenBalanceNumber.toFixed(2);
        }

        // Set the full token balance in the input field
        setTradeAmount(formattedBalance);
      }

      console.log(
        `Switched to ${type} mode with amount: ${
          tradeType === "buy" ? tradeAmount : "full token balance"
        }`
      );
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
      setTransactionStatus("pending");

      // Validate the trade parameters
      if (!tokenDetails.address || !address) {
        toast.error("Missing token or account information");
        setIsTrading(false);
        return;
      }

      // Parse amount as value
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
        token: tokenDetails.symbol,
      });

      // Balance validation with proper typing
      const validation = (await validateTradeBalance(
        address,
        tokenDetails.address,
        tradeType,
        amountInWei,
        publicClient
      )) as ValidationResult;

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
        BigInt(0), // minAmountOut - setting this to 0 for now, should set a reasonable minimum for production
        undefined // referrerAddress
      ) as TradeContractParams;

      console.log("Transaction parameters:", {
        address: tradeParams.address,
        functionName: tradeParams.functionName,
        argsCount: tradeParams.args.length,
        args: tradeParams.args,
        value: tradeParams.value ? tradeParams.value.toString() : "0",
      });

      // Execute trade using writeContractAsync
      const hash = await writeContractAsync(tradeParams);

      console.log(`Transaction sent: ${hash}`);

      // Improved success toast with more details and longer duration
      if (tradeType === "buy") {
        toast.success(
          `Successfully bought ${tokenDetails.symbol}! Transaction sent.`,
          {
            id: "trade-toast",
            duration: 6000, // 6 seconds
            icon: "🎮",
          }
        );
      } else {
        toast.success(
          `Successfully sold ${
            tokenDetails.symbol
          }! You'll receive ~${estimateEthReturn(tradeAmount)} ETH.`,
          {
            id: "trade-toast",
            duration: 6000, // 6 seconds
            icon: "💰",
          }
        );
      }

      setTransactionStatus("success");

      // Refresh balances after successful transaction
      setTimeout(() => {
        updateUserBalances();
      }, 3000);
    } catch (error: unknown) {
      console.error("Transaction error:", error);

      // User rejection handling
      const err = error as { message?: string; code?: number };
      if (err.message?.includes("User rejected") || err.code === 4001) {
        toast.error("Transaction was cancelled", {
          id: "trade-toast",
          duration: 4000,
        });
        // Kullanıcı reddettiğinde işlem sonlandı, yeni istek göndermeyi engelle
        setTransactionStatus("idle");
      } else {
        // Create a more user-friendly error message
        let errorMessage = `Transaction failed`;

        if (err.message) {
          if (err.message.includes("gas")) {
            errorMessage = `Gas estimation failed. You may need to adjust the amount.`;
          } else if (err.message.includes("insufficient")) {
            errorMessage = `Insufficient funds for transaction`;
          } else if (err.message.length < 50) {
            // Only include the actual error if it's reasonably short
            errorMessage = `Error: ${err.message}`;
          }
        }

        toast.error(errorMessage, {
          id: "trade-toast",
          duration: 5000,
        });
        setTransactionStatus("error");
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
        day: "numeric",
      });
    } catch (e) {
      return timestamp;
    }
  };

  // Format balance for display
  const formatBalance = (balance: bigint, decimals: number = 18) => {
    try {
      const balanceNumber = Number(balance) / 10 ** decimals;

      // Format with abbreviations
      if (balanceNumber >= 1_000_000_000_000) {
        // Trillion
        return (balanceNumber / 1_000_000_000_000).toFixed(2) + "T";
      } else if (balanceNumber >= 1_000_000_000) {
        // Billion
        return (balanceNumber / 1_000_000_000).toFixed(2) + "B";
      } else if (balanceNumber >= 1_000_000) {
        // Million
        return (balanceNumber / 1_000_000).toFixed(2) + "M";
      } else if (balanceNumber >= 1_000) {
        // Thousand
        return (balanceNumber / 1_000).toFixed(2) + "K";
      } else if (balanceNumber < 0.001 && balanceNumber > 0) {
        return balanceNumber.toExponential(4);
      }

      // Regular format for smaller numbers
      return balanceNumber < 1
        ? balanceNumber.toFixed(5)
        : balanceNumber.toFixed(2);
    } catch (e) {
      return "0";
    }
  };

  // Calculate USD value - updated to handle both buy and sell directions
  const calculateUsdValue = (amountStr: string) => {
    try {
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) return "0.00";

      // For buy operations, it's straightforward: ETH amount * ETH/USD rate
      // For sell operations, we need to estimate the ETH output based on token amount
      let usdValue = 0;

      if (tradeType === "buy") {
        // Simple ETH to USD conversion
        usdValue = amount * ethToUsdRate;
      } else {
        // For sell, we need to estimate how much ETH (and thus USD) they'll receive
        // This is a simplified calculation that should match Zora's actual formula better
        // Assuming 1% slippage for larger amounts
        let estimatedEthReturn = 0;

        if (tokenDetails?.marketCap && tokenDetails?.totalSupply) {
          // Use market data when available for more accurate estimation
          const marketCap = parseFloat(tokenDetails.marketCap);
          const totalSupply = parseFloat(tokenDetails.totalSupply);

          if (!isNaN(marketCap) && !isNaN(totalSupply) && totalSupply > 0) {
            // Calculate token price in ETH
            const tokenPriceInEth = marketCap / (totalSupply * ethToUsdRate);
            // Apply slippage based on amount relative to total supply
            const percentOfSupply = amount / totalSupply;
            const slippage = Math.min(percentOfSupply * 100, 0.1); // Max 10% slippage

            estimatedEthReturn = amount * tokenPriceInEth * (1 - slippage);
          }
        } else {
          // Fallback calculation if market data isn't available
          // This is very approximative and should be improved with actual pool data
          estimatedEthReturn = amount / 1000000; // Very rough estimate
        }

        // Calculate USD value based on estimated ETH return
        usdValue = estimatedEthReturn * ethToUsdRate;
      }

      // Format with abbreviations
      if (usdValue >= 1_000_000_000) {
        // Billion
        return (usdValue / 1_000_000_000).toFixed(2) + "B";
      } else if (usdValue >= 1_000_000) {
        // Million
        return (usdValue / 1_000_000).toFixed(2) + "M";
      } else if (usdValue >= 1_000) {
        // Thousand
        return (usdValue / 1_000).toFixed(2) + "K";
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
    const value = typeof num === "string" ? parseFloat(num) : num;
    if (isNaN(value)) return "N/A";

    if (value >= 1_000_000_000_000) {
      // Trillion
      return (value / 1_000_000_000_000).toFixed(2) + "T";
    } else if (value >= 1_000_000_000) {
      // Billion
      return (value / 1_000_000_000).toFixed(2) + "B";
    } else if (value >= 1_000_000) {
      // Million
      return (value / 1_000_000).toFixed(2) + "M";
    } else if (value >= 1_000) {
      // Thousand
      return (value / 1_000).toFixed(2) + "K";
    } else if (value < 0.001 && value > 0) {
      return value.toExponential(4);
    }
    return value < 1 ? value.toFixed(4) : value.toFixed(2);
  };

  // Add this function to estimate token amount when buying
  const estimateTokenAmount = (ethAmountStr: string): string => {
    try {
      const ethAmount = parseFloat(ethAmountStr);
      if (isNaN(ethAmount) || ethAmount <= 0 || !tokenDetails) return "0";

      let estimatedTokenAmount = 0;

      // We need to use a more accurate model of how Zora's trading function works
      if (tokenDetails.marketCap && tokenDetails.totalSupply) {
        const marketCap = parseFloat(tokenDetails.marketCap); // In USD
        const totalSupply = parseFloat(tokenDetails.totalSupply);

        if (!isNaN(marketCap) && !isNaN(totalSupply) && totalSupply > 0) {
          // Calculate approximate token price in ETH
          const tokenPriceInUsd = marketCap / totalSupply;
          const tokenPriceInEth = tokenPriceInUsd / ethToUsdRate;

          // Using Zora's bonding curve formula (simplified approximation)
          // The actual formula has slippage based on pool size
          // For small buys relative to pool size: amount ≈ ethAmount / tokenPriceInEth

          // Apply estimated slippage - larger buys get fewer tokens due to price impact
          const ethInUsd = ethAmount * ethToUsdRate;
          const percentOfMarketCap = (ethInUsd / marketCap) * 100;
          // Progressive slippage: bigger buys have more slippage
          const slippage = Math.min(percentOfMarketCap * 0.5, 0.15); // Max 15% slippage

          estimatedTokenAmount = (ethAmount / tokenPriceInEth) * (1 - slippage);
        }
      } else if (tokenDetails.volume24h) {
        // Fallback to volume-based estimate if market cap isn't available
        const volume = parseFloat(tokenDetails.volume24h);
        if (!isNaN(volume) && volume > 0) {
          // Very rough approximation based on 24h volume
          estimatedTokenAmount = (ethAmount * ethToUsdRate) / (volume * 0.01);
        } else {
          // Generic fallback
          estimatedTokenAmount = ethAmount * 1000; // Very rough estimate
        }
      } else {
        // Generic fallback for tokens with no market data
        estimatedTokenAmount = ethAmount * 1000; // Very rough estimate
      }

      // Format with appropriate precision
      if (estimatedTokenAmount >= 1_000_000_000) {
        return (estimatedTokenAmount / 1_000_000_000).toFixed(2) + "B";
      } else if (estimatedTokenAmount >= 1_000_000) {
        return (estimatedTokenAmount / 1_000_000).toFixed(2) + "M";
      } else if (estimatedTokenAmount >= 1_000) {
        return (estimatedTokenAmount / 1_000).toFixed(2) + "K";
      } else if (estimatedTokenAmount < 0.001 && estimatedTokenAmount > 0) {
        return estimatedTokenAmount.toExponential(4);
      } else {
        return estimatedTokenAmount.toFixed(estimatedTokenAmount < 1 ? 4 : 2);
      }
    } catch (e) {
      return "0";
    }
  };

  // Improved ETH return estimation for selling that better matches Warpcast values
  const estimateEthReturn = (tokenAmountStr: string): string => {
    try {
      const amount = parseFloat(tokenAmountStr);
      if (isNaN(amount) || amount <= 0 || !tokenDetails) return "0";

      let estimatedEthReturn = 0;

      if (
        tokenDetails.marketCap &&
        tokenDetails.totalSupply &&
        tokenDetails.volume24h
      ) {
        // Use volume, market cap, and supply for more accurate estimation
        const marketCap = parseFloat(tokenDetails.marketCap);
        const totalSupply = parseFloat(tokenDetails.totalSupply);
        const volume24h = parseFloat(tokenDetails.volume24h);

        if (!isNaN(marketCap) && !isNaN(totalSupply) && totalSupply > 0) {
          // Calculate token price in ETH with adjustments for volume
          const tokenPriceInUsd = marketCap / totalSupply;
          const tokenPriceInEth = tokenPriceInUsd / ethToUsdRate;

          // Apply slippage based on amount relative to volume and total supply
          const percentOfSupply = (amount / totalSupply) * 100;
          const volumeRatio = volume24h / marketCap;

          // High volume/market cap ratio means more liquidity & less slippage
          const liquidityFactor = Math.min(volumeRatio * 50, 1); // Scale from 0-1

          // Calculate slippage - higher for larger sells relative to supply
          // Adjusted based on volume/mc ratio (more volume = less slippage)
          const baseSlippage = Math.min(percentOfSupply * 2, 0.2); // Max 20% slippage
          const adjustedSlippage = baseSlippage * (1 - liquidityFactor);

          // Apply the slippage to the token price
          estimatedEthReturn =
            amount * tokenPriceInEth * (1 - adjustedSlippage);
        }
      } else if (tokenDetails.marketCap && tokenDetails.totalSupply) {
        // Fallback to just market cap and supply if no volume data
        const marketCap = parseFloat(tokenDetails.marketCap);
        const totalSupply = parseFloat(tokenDetails.totalSupply);

        if (!isNaN(marketCap) && !isNaN(totalSupply) && totalSupply > 0) {
          // Calculate token price in ETH
          const tokenPriceInUsd = marketCap / totalSupply;
          const tokenPriceInEth = tokenPriceInUsd / ethToUsdRate;

          // Apply more conservative slippage without volume data
          const percentOfSupply = (amount / totalSupply) * 100;
          const slippage = Math.min(percentOfSupply * 3, 0.25); // Higher slippage

          estimatedEthReturn = amount * tokenPriceInEth * (1 - slippage);
        }
      } else {
        // Very basic fallback with no market data - deliberately more conservative
        estimatedEthReturn = amount / 10000000; // Very rough estimate
      }

      // Format the ETH value with appropriate precision
      if (estimatedEthReturn < 0.00001) {
        return estimatedEthReturn.toExponential(4);
      } else if (estimatedEthReturn < 0.001) {
        return estimatedEthReturn.toFixed(6);
      } else if (estimatedEthReturn < 0.1) {
        return estimatedEthReturn.toFixed(4);
      } else {
        return estimatedEthReturn.toFixed(3);
      }
    } catch (e) {
      return "0";
    }
  };

  return (
    <div className="retro-container p-2 border-2 border-retro-primary  items-center">
      <div className="flex items-center mb-3 bg-gradient-to-r from-retro-primary/30 to-retro-primary/10 p-2  border border-retro-primary">
        <RetroButton
          onClick={onBack}
          variant="outline"
          className="mr-2 text-xs border-retro-primary hover:bg-retro-primary/20 transition-all"
        >
          Back
        </RetroButton>
        <h2 className="retro-header text-sm text-retro-primary font-bold pixelated">
          {tokenDetails?.symbol || "Token"} Details
        </h2>
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
                <Image
                  src={tokenDetails.imageUri}
                  alt={tokenDetails.name}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-md pixelated border-2 border-retro-primary object-cover"
                  unoptimized
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.style.display = "none";
                    const parent = target.parentNode;
                    if (parent) {
                      const svgPlaceholder = document.createElement("div");
                      svgPlaceholder.className =
                        "w-16 h-16 bg-retro-primary/5 flex items-center justify-center rounded-md border-2 border-retro-primary";
                      svgPlaceholder.innerHTML = `<span class="text-retro-primary text-2xl font-bold pixelated">${tokenDetails.symbol.charAt(
                        0
                      )}</span>`;
                      parent.appendChild(svgPlaceholder);
                    }
                  }}
                />
              ) : (
                <div className="w-16 h-16 bg-retro-primary/5 flex items-center justify-center rounded-md border-2 border-retro-primary">
                  <span className="text-retro-primary text-2xl font-bold pixelated">
                    {tokenDetails.symbol.charAt(0)}
                  </span>
                </div>
              )}

              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="text-sm font-bold text-retro-primary mb-0.5 pixelated">
                    {tokenDetails.name}
                  </h3>
                  <div className="text-xs text-retro-accent mb-1  px-2 py-0.5 inline-block  border border-retro-primary">
                    {tokenDetails.symbol}
                  </div>
                </div>

                <div className="text-xs text-retro-secondary truncate mt-1 font-mono p-1 border border-retro-primary flex items-center justify-between">
                  <span className="cursor-pointer">
                    {tokenDetails.address}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(tokenDetails.address)}
                    className="hover:text-retro-accent transition-colors"
                    title="Copy address"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            {tokenDetails.creator.profileName && (
              <div className="mt-2 flex items-center">
                <span className="text-xs text-retro-secondary mr-1">
                  Created by:
                </span>
                <span className="text-xs text-retro-accent  px-2 py-0.5  border border-retro-primary">
                  @{tokenDetails.creator.profileName}
                </span>
              </div>
            )}
          </div>
          {tokenDetails.description && (
            <div className="mb-4 bg-black/20 p-3  border-2 border-retro-primary">
              <h4 className="font-bold text-retro-primary text-xs mb-2 pixelated flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1"
                >
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

          {/* Token stats in grid layout */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {tokenDetails.uniqueHolders && (
              <div className=" p-2  border-2 border-retro-primary  transition-all">
                <span className="text-retro-secondary text-xs font-bold block mb-1">
                  HOLDERS
                </span>
                <span className="text-retro-accent text-sm font-mono">
                  {tokenDetails.uniqueHolders}
                </span>
              </div>
            )}
            {tokenDetails.marketCap && (
              <div className=" p-2  border-2 border-retro-primary  transition-all">
                <span className="text-retro-secondary text-xs font-bold block mb-1">
                  MARKET CAP
                </span>
                <span className="text-retro-accent text-sm font-mono">
                  ${formatNumberWithAbbreviations(tokenDetails.marketCap)}
                </span>
              </div>
            )}
            {tokenDetails.volume24h && (
              <div className=" p-2  border-2 border-retro-primary  transition-all">
                <span className="text-retro-secondary text-xs font-bold block mb-1">
                  24H VOLUME
                </span>
                <span className="text-retro-accent text-sm font-mono">
                  ${formatNumberWithAbbreviations(tokenDetails.volume24h)}
                </span>
              </div>
            )}
            {tokenDetails.totalSupply && (
              <div className=" p-2  border-2 border-retro-primary  transition-all">
                <span className="text-retro-secondary text-xs font-bold block mb-1">
                  SUPPLY
                </span>
                <span className="text-retro-accent text-sm font-mono">
                  {formatNumberWithAbbreviations(tokenDetails.totalSupply)}
                </span>
              </div>
            )}
          </div>

          {/* Description with better styling */}

          {/* Trading section with improved UI */}
          <div className="mt-5 mb-2">
            <div className="flex items-center bg-gradient-to-r from-retro-primary/30 to-retro-primary/10 p-2  border border-retro-primary mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1 text-retro-accent"
              >
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              <h4 className="font-bold text-retro-primary text-xs pixelated">
                TRADE {tokenDetails.symbol}
              </h4>
            </div>

            {isConnected && (
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div className=" p-2  border border-retro-primary">
                  <span className="text-retro-secondary font-bold block mb-1">
                    YOUR ETH:
                  </span>
                  <span className="text-retro-accent font-mono">
                    {formatBalance(userEthBalance)}
                  </span>
                </div>
                <div className=" p-2  border border-retro-primary">
                  <span className="text-retro-secondary font-bold block mb-1">
                    YOUR {tokenDetails.symbol}:
                  </span>
                  <span className="text-retro-accent font-mono">
                    {formatBalance(userTokenBalance)}
                  </span>
                </div>
              </div>
            )}

            {/* Trade type buttons with improved UI */}
            <div className="flex gap-2 mb-4">
              <RetroButton
                onClick={() => handleTradeTypeChange("buy")}
                variant={tradeType === "buy" ? "default" : "outline"}
                className={`flex-1 text-xs py-2 transition-all duration-300 ${
                  tradeType === "buy"
                    ? "bg-retro-primary shadow-[0_0_10px_rgba(255,107,53,0.3)]"
                    : "bg-transparent border-retro-primary hover:bg-retro-primary/10"
                }`}
              >
                BUY {tokenDetails.symbol}
              </RetroButton>
              <RetroButton
                onClick={() => handleTradeTypeChange("sell")}
                variant={tradeType === "sell" ? "default" : "outline"}
                className={`flex-1 text-xs py-2 transition-all duration-300 ${
                  tradeType === "sell"
                    ? "bg-retro-primary shadow-[0_0_10px_rgba(255,107,53,0.3)]"
                    : "bg-transparent border-retro-primary hover:bg-retro-primary/10"
                }`}
              >
                SELL {tokenDetails.symbol}
              </RetroButton>
            </div>

            <div className=" p-3  border-2 border-retro-primary mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="retro-label text-xs text-retro-primary font-bold pixelated">
                  {tradeType === "buy"
                    ? `ETH AMOUNT TO USE`
                    : `${tokenDetails.symbol} AMOUNT TO SELL`}
                </label>

                {/* Show balance in the label area */}
              </div>

              {/* Add sell mode indicator */}

              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  className={`retro-input w-full mb-2 text-xs py-2 border-2 ${
                    tradeType === "sell"
                      ? "border-retro-accent text-retro-accent bg-black/80"
                      : "border-retro-primary text-retro-accent bg-black/60"
                  }`}
                  value={tradeAmount}
                  onChange={handleTradeAmountChange}
                  placeholder={
                    tradeType === "buy"
                      ? "Enter ETH amount"
                      : `Enter ${tokenDetails.symbol} amount`
                  }
                />
              </div>

              {/* Helper text for percentage selection */}

              {/* Percentage buttons in flex layout */}
              <div className="grid grid-cols-4 gap-1 mb-3">
                {[10, 25, 50, 99].map((percent) => (
                  <RetroButton
                    key={percent}
                    onClick={() => setPredefinedAmount(percent)}
                    variant={
                      selectedPurchasePercentage === percent && !isCustomAmount
                        ? "default"
                        : "outline"
                    }
                    className={`text-xs py-1 transition-all ${
                      selectedPurchasePercentage === percent && !isCustomAmount
                        ? "bg-retro-primary"
                        : "bg-transparent border-retro-primary hover:bg-retro-primary/20"
                    }`}
                  >
                    {percent === 99 ? "MAX" : `${percent}%`}
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
                  background: `linear-gradient(to right, var(--retro-primary) 0%, var(--retro-primary) ${selectedPurchasePercentage}%, rgba(255, 107, 53, 0.1) ${selectedPurchasePercentage}%, rgba(255, 107, 53, 0.1) 100%)`,
                }}
              />
              <div className="text-xs text-retro-accent text-right font-mono p-1 ">
                {tradeType === "buy"
                  ? `≈ $${calculateUsdValue(
                      tradeAmount
                    )} USD (Receive: ~${estimateTokenAmount(tradeAmount)} ${
                      tokenDetails.symbol
                    })`
                  : `≈ $${calculateUsdValue(
                      tradeAmount
                    )} USD (Receive: ~${estimateEthReturn(tradeAmount)} ETH)`}
              </div>
            </div>

            {isConnected ? (
              <RetroButton
                onClick={handleTradeClick}
                isLoading={isTrading}
                fullWidth
                className="text-xs bg-retro-primary hover:bg-retro-primary/90 transition-all duration-300 shadow-[0_0_10px_rgba(255,107,53,0.3)] hover:shadow-[0_0_15px_rgba(255,107,53,0.4)] border-2 border-retro-primary/70 py-3 font-bold"
              >
                {tradeType === "buy"
                  ? `BUY ${tokenDetails.symbol} NOW`
                  : `SELL ${tokenDetails.symbol} NOW`}
              </RetroButton>
            ) : (
              <div className="text-center p-3 border border-retro-primary  ">
                <p className="text-retro-secondary text-xs mb-2">
                  Connect your wallet to trade this token
                </p>
                <div className="animate-pulse h-1 w-20 bg-retro-primary/30 mx-auto rounded"></div>
              </div>
            )}

            {/* Trading tips section */}
            <div className="text-xs text-retro-accent mt-4  p-3  border border-retro-primary">
              <div className="flex items-center mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1 text-retro-primary"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p className="font-semibold text-retro-primary">
                  TRADING TIPS:
                </p>
              </div>
              <ul className="ml-5 space-y-1 list-disc">
                <li>Received amounts may sometimes be inaccurate</li>
                <li>Always leave some ETH for gas fees</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center p-5 border-2 border-retro-primary  bg-black/70">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-3 text-retro-primary/70"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p className="text-retro-accent text-sm mb-3">
            Token not found or data unavailable.
          </p>
          <RetroButton
            onClick={onBack}
            className="text-xs bg-retro-primary hover:bg-retro-primary/90 transition-all duration-300 shadow-[0_0_6px_rgba(255,107,53,0.2)]"
          >
            RETURN TO EXPLORE
          </RetroButton>
        </div>
      )}

      {/* Transaction retry button - Hata durumunda yeniden deneme butonu */}
      {transactionStatus === "error" && (
        <div className="mt-4 flex justify-center">
          <RetroButton
            onClick={() => {
              setTransactionStatus("idle");
              handleTradeClick();
            }}
            className="text-sm py-1 px-4 bg-retro-primary hover:bg-retro-primary/80"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
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
