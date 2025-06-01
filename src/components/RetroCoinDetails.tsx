import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { toast } from "react-hot-toast";
import { getCoinDetails, fetchCoinComments } from "../services/sdk/getCoins.js";
import {
  validateTradeBalance,
  checkETHBalance,
  checkTokenBalance,
  getTradeContractCallParams,
} from "../services/sdk/getTradeCoin.js";
import {
  getOnchainTokenDetails,
  getLiquidityInfo,
  getMarketCapInfo,
  getTokenPrice,
} from "../services/sdk/getOnchainData.js";
import { analyzeTokenWithAI } from "../services/aiService";
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
  marketCapDelta24h?: string;
  transfers?: {
    count: number;
  };
}

// Token Score Interface
interface TokenScore {
  overall: number;
  liquidity: number;
  volume: number;
  community: number;
  risk: number;
  growth: number;
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
  marketCapDelta24h?: string;
  transfers?: {
    count: number;
  };
  zoraComments?: {
    count: number;
  };
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

// Comment interface matching the actual API structure
interface Comment {
  node: {
    txHash: string;
    comment: string;
    userAddress: string;
    timestamp: number;
    userProfile: {
      id: string;
      handle: string;
      avatar?: {
        previewImage?: {
          blurhash: string;
          small: string;
          medium: string;
        };
      };
    };
    replies?: {
      count: number;
      edges: any[];
    };
  };
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

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisQuestion, setAnalysisQuestion] = useState(
    "What is this token about and what are its key metrics?"
  );

  // Onchain data states
  const [onchainData, setOnchainData] = useState<any>(null);
  const [isLoadingOnchain, setIsLoadingOnchain] = useState(false);

  // Comments states
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsPageInfo, setCommentsPageInfo] = useState<any>(null);
  const [totalCommentsCount, setTotalCommentsCount] = useState(0);

  // Token Score state
  const [tokenScore, setTokenScore] = useState<TokenScore | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<"details" | "trade" | "analysis">(
    "details"
  );

  // Calculate Token Score
  const calculateTokenScore = useCallback(
    (
      tokenData: TokenDetails,
      onchainData: any,
      commentsCount: number
    ): TokenScore => {
      // Liquidity Score (0-100)
      const marketCapNum = parseFloat(tokenData.marketCap || "0");
      const liquidityScore = Math.min(
        100,
        Math.max(
          0,
          marketCapNum > 100000
            ? 90
            : marketCapNum > 50000
            ? 80
            : marketCapNum > 10000
            ? 60
            : marketCapNum > 1000
            ? 40
            : 20
        )
      );

      // Volume Score (0-100)
      const volume24h = parseFloat(tokenData.volume24h || "0");
      const totalVolume = parseFloat(tokenData.totalVolume || "0");
      const volumeScore = Math.min(
        100,
        Math.max(
          0,
          volume24h > 10000
            ? 95
            : volume24h > 1000
            ? 80
            : volume24h > 100
            ? 60
            : volume24h > 10
            ? 40
            : totalVolume > 50000
            ? 30
            : 10
        )
      );

      // Community Score (0-100)
      const holders = tokenData.uniqueHolders || 0;
      const transfers = tokenData.transfers?.count || 0;
      const communityScore = Math.min(
        100,
        Math.max(
          0,
          (holders > 1000
            ? 40
            : holders > 500
            ? 30
            : holders > 100
            ? 20
            : holders > 10
            ? 10
            : 5) +
            (commentsCount > 50
              ? 25
              : commentsCount > 20
              ? 20
              : commentsCount > 5
              ? 15
              : commentsCount > 0
              ? 10
              : 0) +
            (transfers > 10000
              ? 35
              : transfers > 1000
              ? 25
              : transfers > 100
              ? 15
              : transfers > 10
              ? 10
              : 5)
        )
      );

      // Risk Score (0-100, lower is better, inverted for display)
      const age = tokenData.createdAt
        ? (Date.now() - new Date(tokenData.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
        : 0;
      const riskFactors = [
        age < 1 ? 30 : age < 7 ? 20 : age < 30 ? 10 : 0, // Age risk
        holders < 10 ? 25 : holders < 50 ? 15 : holders < 100 ? 10 : 0, // Holder concentration risk
        marketCapNum < 1000 ? 20 : marketCapNum < 10000 ? 10 : 0, // Market cap risk
        volume24h < 1 ? 25 : volume24h < 10 ? 15 : 0, // Liquidity risk
      ];
      const totalRisk = riskFactors.reduce((sum, risk) => sum + risk, 0);
      const riskScore = Math.max(0, 100 - totalRisk); // Invert so higher is better

      // Growth Score (0-100)
      const marketCapDelta = parseFloat(tokenData.marketCapDelta24h || "0");
      const growthScore = Math.min(
        100,
        Math.max(
          0,
          marketCapDelta > 50
            ? 95
            : marketCapDelta > 20
            ? 80
            : marketCapDelta > 10
            ? 70
            : marketCapDelta > 0
            ? 60
            : marketCapDelta > -10
            ? 40
            : marketCapDelta > -20
            ? 25
            : 10
        )
      );

      // Overall Score (weighted average)
      const overallScore = Math.round(
        liquidityScore * 0.25 +
          volumeScore * 0.2 +
          communityScore * 0.2 +
          riskScore * 0.2 +
          growthScore * 0.15
      );

      return {
        overall: overallScore,
        liquidity: Math.round(liquidityScore),
        volume: Math.round(volumeScore),
        community: Math.round(communityScore),
        risk: Math.round(riskScore),
        growth: Math.round(growthScore),
      };
    },
    []
  );

  // Get score color
  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  // Get score label
  const getScoreLabel = (score: number): string => {
    if (score >= 90) return "EXCELLENT";
    if (score >= 80) return "VERY GOOD";
    if (score >= 70) return "GOOD";
    if (score >= 60) return "FAIR";
    if (score >= 40) return "POOR";
    return "VERY POOR";
  };

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

  // Fetch onchain data
  const fetchOnchainData = useCallback(
    async (tokenAddress: string) => {
      if (!tokenAddress) return;

      setIsLoadingOnchain(true);
      try {
        console.log("Fetching onchain data for:", tokenAddress);
        const data = await getOnchainTokenDetails(
          tokenAddress,
          address || undefined
        );
        setOnchainData(data);
        console.log("Onchain data loaded:", data);
      } catch (error) {
        console.error("Error fetching onchain data:", error);
      } finally {
        setIsLoadingOnchain(false);
      }
    },
    [address]
  );

  // Fetch comments with corrected structure
  const fetchCommentsData = useCallback(
    async (tokenAddress: string, after: string | null = null) => {
      if (!tokenAddress) return;

      setIsLoadingComments(true);
      try {
        console.log("Fetching comments for:", tokenAddress, "after:", after);
        const data = (await fetchCoinComments(
          tokenAddress,
          10,
          after || undefined
        )) as {
          comments: Comment[];
          pageInfo: any;
          totalCount: number;
        };

        if (after) {
          // Append to existing comments for pagination
          setComments((prev) => [...prev, ...(data.comments || [])]);
        } else {
          // First load
          setComments(data.comments || []);
        }

        setCommentsPageInfo(data.pageInfo || null);
        setTotalCommentsCount(data.totalCount || 0);
        console.log("Comments loaded:", data);
      } catch (error) {
        console.error("Error fetching comments:", error);
        toast.error("Failed to load comments");
      } finally {
        setIsLoadingComments(false);
      }
    },
    []
  );

  // Load more comments
  const loadMoreComments = useCallback(() => {
    if (
      commentsPageInfo?.hasNextPage &&
      commentsPageInfo?.endCursor &&
      tokenDetails?.address
    ) {
      fetchCommentsData(tokenDetails.address, commentsPageInfo.endCursor);
    }
  }, [commentsPageInfo, tokenDetails?.address, fetchCommentsData]);

  // Calculate purchase amount based on percentage of balance
  const calculatePurchaseAmount = useCallback(
    (percentage: number): string => {
      if (tradeType === "buy") {
        if (userEthBalance === BigInt(0)) return "0.001";

        // Calculate percentage of ETH balance (leave some for gas)
        const maxUsableBalance = (userEthBalance * BigInt(98)) / BigInt(100); // Use max 95% of balance to leave gas
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

  // Handle trade type change with improved functionality
  const handleTradeTypeChange = (type: "buy" | "sell") => {
    // Only perform actions if the type is actually changing
    if (type !== tradeType) {
      setTradeType(type);
      setIsCustomAmount(false);

      // Update amounts based on new trade type
      if (type === "buy") {
        // For buy trades, calculate based on ETH balance
        const newAmount = calculatePurchaseAmount(selectedPurchasePercentage);
        setTradeAmount(newAmount);
        console.log(
          `Switched to BUY: ${selectedPurchasePercentage}% of ETH balance = ${newAmount} ETH`
        );
      } else {
        // For sell trades, calculate based on token balance
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
        console.log(
          `Switched to SELL: ${selectedPurchasePercentage}% of token balance = ${formattedAmount} ${tokenDetails?.symbol}`
        );
      }
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
      if (!amount || amount <= 0 || !tokenDetails) return "0";

      let estimatedEthReturn = 0;

      // Use volume data for better price calculation if available
      if (tokenDetails.volume24h && tokenDetails.uniqueHolders) {
        const volume24h = parseFloat(tokenDetails.volume24h);
        const holders = tokenDetails.uniqueHolders;

        if (!isNaN(volume24h) && volume24h > 0 && holders > 0) {
          // Estimate daily price impact based on volume and holders
          const avgTradeSize = volume24h / (holders * 2); // Rough estimate
          const percentOfDailyVolume = (amount * ethToUsdRate) / volume24h;

          // Calculate token price from market cap
          const marketCap = parseFloat(tokenDetails.marketCap || "0");
          const totalSupply = parseFloat(tokenDetails.totalSupply || "0");

          if (marketCap > 0 && totalSupply > 0) {
            const tokenPriceInUsd = marketCap / totalSupply;
            const tokenPriceInEth = tokenPriceInUsd / ethToUsdRate;

            // Apply slippage based on trade size vs daily volume
            const baseSlippage = 0.01; // 1% base slippage
            const volumeSlippage = Math.min(percentOfDailyVolume * 2, 0.15); // Max 15% slippage
            const adjustedSlippage = baseSlippage + volumeSlippage;

            // Apply the slippage to the token price
            estimatedEthReturn =
              amount * tokenPriceInEth * (1 - adjustedSlippage);
          }
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

  // Token Analysis Function
  const handleAnalyzeToken = async () => {
    if (!tokenDetails) {
      toast.error("No token data available for analysis");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Prepare token data for analysis including onchain data
      const tokenDataForAnalysis = {
        name: tokenDetails.name,
        symbol: tokenDetails.symbol,
        description: tokenDetails.description || "",
        marketCap: tokenDetails.marketCap,
        volume24h: tokenDetails.volume24h,
        totalVolume: tokenDetails.totalVolume,
        uniqueHolders: tokenDetails.uniqueHolders,
        totalSupply: tokenDetails.totalSupply,
        createdAt: tokenDetails.createdAt,
        address: tokenDetails.address,
        // Add onchain data if available
        transfers: { count: comments.length }, // Use comments as proxy for activity
        zoraComments: { count: totalCommentsCount },
      };

      console.log("Analyzing token with onchain data:", tokenDataForAnalysis);

      const result = await analyzeTokenWithAI(
        tokenDataForAnalysis,
        analysisQuestion,
        onchainData // Pass onchain data as third parameter
      );

      setAnalysisResult(result.analysis);
      setShowAnalysis(true);
      toast.success("Analysis completed!");
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error(
        `Analysis failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Format analysis text for better display
  const formatAnalysisText = (text: string) => {
    return text
      .split("\n")
      .map((line, index) => {
        // Handle section headers
        if (
          line.includes("OVERVIEW:") ||
          line.includes("METRICS ANALYSIS:") ||
          line.includes("STRENGTHS AND WEAKNESSES:") ||
          line.includes("INVESTMENT ANSWER:") ||
          line.includes("ANSWER:")
        ) {
          return (
            <div
              key={index}
              className="font-bold text-retro-primary text-xs mb-2 mt-3 pixelated"
            >
              {line}
            </div>
          );
        }
        // Handle bullet points
        if (line.trim().startsWith("-")) {
          return (
            <div key={index} className="text-retro-accent text-xs ml-4 mb-1">
              • {line.trim().substring(1)}
            </div>
          );
        }
        // Handle regular text
        if (line.trim()) {
          return (
            <div key={index} className="text-retro-accent text-xs mb-2">
              {line}
            </div>
          );
        }
        return null;
      })
      .filter(Boolean);
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
            marketCapDelta24h: data.marketCapDelta24h,
            transfers: data.transfers,
          });

          // Fetch onchain data and comments when token details are loaded
          fetchOnchainData(data.address);
          fetchCommentsData(data.address);
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
  }, [coinAddress, isConnected, fetchOnchainData, fetchCommentsData]);

  // Update balances and fetch ETH price
  useEffect(() => {
    if (tokenDetails) {
      fetchEthPrice();
      updateUserBalances();
    }
  }, [tokenDetails, updateUserBalances, fetchEthPrice]);

  // Calculate token score when data is available
  useEffect(() => {
    if (tokenDetails && !isLoadingComments && !isLoadingOnchain) {
      const score = calculateTokenScore(
        tokenDetails,
        onchainData,
        totalCommentsCount
      );
      setTokenScore(score);
    }
  }, [
    tokenDetails,
    onchainData,
    totalCommentsCount,
    isLoadingComments,
    isLoadingOnchain,
    calculateTokenScore,
  ]);

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
                  <span className="cursor-pointer">{tokenDetails.address}</span>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(tokenDetails.address)
                    }
                    className="hover:text-retro-accent transition-colors"
                    title="Copy address"
                  >
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
                    >
                      <rect
                        x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        ry="2"
                      ></rect>
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

          {/* Tab Navigation */}
          <div className="mb-4">
            <div className="flex gap-1 p-1 bg-black/30 border-2 border-retro-primary rounded">
              <button
                onClick={() => setActiveTab("details")}
                className={`flex-1 text-xs py-2 px-3 transition-all duration-200 pixelated font-bold flex items-center justify-center gap-1 ${
                  activeTab === "details"
                    ? "bg-retro-primary text-black shadow-[0_0_8px_rgba(255,107,53,0.5)]"
                    : "text-retro-accent hover:bg-retro-primary/20"
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 3v18h18" />
                  <path d="M7 12h10" />
                  <path d="M7 8h10" />
                  <path d="M7 16h6" />
                </svg>
                DETAILS
              </button>
              <button
                onClick={() => setActiveTab("trade")}
                className={`flex-1 text-xs py-2 px-3 transition-all duration-200 pixelated font-bold flex items-center justify-center gap-1 ${
                  activeTab === "trade"
                    ? "bg-retro-primary text-black shadow-[0_0_8px_rgba(255,107,53,0.5)]"
                    : "text-retro-accent hover:bg-retro-primary/20"
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                TRADE
              </button>
              <button
                onClick={() => setActiveTab("analysis")}
                className={`flex-1 text-xs py-2 px-3 transition-all duration-200 pixelated font-bold flex items-center justify-center gap-1 ${
                  activeTab === "analysis"
                    ? "bg-retro-primary text-black shadow-[0_0_8px_rgba(255,107,53,0.5)]"
                    : "text-retro-accent hover:bg-retro-primary/20"
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
                AI ANALYSIS
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "details" && (
            <div>
              {/* Description */}
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
                  <p className="text-retro-accent whitespace-pre-line text-xs max-h-32 overflow-y-auto font-mono ">
                    {tokenDetails.description}
                  </p>
                </div>
              )}

              {/* Token Score Section */}
              {tokenScore && (
                <div className="mb-4 bg-gradient-to-br from-retro-primary/10 via-retro-primary/5 to-black/40 p-4 border-2 border-retro-primary shadow-[0_0_15px_rgba(255,107,53,0.2)]">
                  <h4 className="font-bold  text-xs mb-3 pixelated flex items-center">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2"
                    >
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                    TOKEN SCORE & RATING
                  </h4>

                  {/* Overall Score */}
                  <div className="mb-4 text-center p-3 border-2 border-retro-primary bg-black/30">
                    <div
                      className={`text-3xl font-bold pixelated mb-1 ${getScoreColor(
                        tokenScore.overall
                      )} drop-shadow-[0_0_8px_currentColor]`}
                    >
                      {tokenScore.overall}/100
                    </div>
                    <div className="text-xs font-bold pixelated text-retro-primary">
                      {getScoreLabel(tokenScore.overall)}
                    </div>
                  </div>

                  {/* Individual Scores */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 border-2 border-retro-primary bg-black/20">
                      <div className="flex justify-between items-center">
                        <span className="text-retro-primary text-xs font-bold">
                          LIQUIDITY
                        </span>
                        <span className="text-retro-secondary text-xs font-bold">
                          {tokenScore.liquidity}
                        </span>
                      </div>
                    </div>
                    <div className="p-2 border-2 border-retro-primary bg-black/20">
                      <div className="flex justify-between items-center">
                        <span className="text-retro-primary text-xs font-bold">
                          VOLUME
                        </span>
                        <span className="text-retro-secondary text-xs font-bold">
                          {tokenScore.volume}
                        </span>
                      </div>
                    </div>
                    <div className="p-2 border-2 border-retro-primary bg-black/20">
                      <div className="flex justify-between items-center">
                        <span className="text-retro-primary text-xs font-bold">
                          COMMUNITY
                        </span>
                        <span className="text-retro-secondary text-xs font-bold">
                          {tokenScore.community}
                        </span>
                      </div>
                    </div>
                    <div className="p-2 border-2 border-retro-primary bg-black/20">
                      <div className="flex justify-between items-center">
                        <span className="text-retro-primary text-xs font-bold">
                          RISK
                        </span>
                        <span className="text-retro-secondary text-xs font-bold">
                          {tokenScore.risk}
                        </span>
                      </div>
                    </div>
                    <div className="p-2 border-2 border-retro-primary bg-black/20">
                      <div className="flex justify-between items-center">
                        <span className="text-retro-primary text-xs font-bold">
                          GROWTH
                        </span>
                        <span className="text-retro-secondary text-xs font-bold">
                          {tokenScore.growth}
                        </span>
                      </div>
                    </div>
                    <div className="p-2 border-2 border-retro-primary bg-black/20">
                      <div className="flex justify-between items-center">
                        <span className="text-retro-primary text-xs font-bold">
                          TRANSFERS
                        </span>
                        <span className="text-retro-secondary text-xs font-bold">
                          {formatNumberWithAbbreviations(
                            tokenDetails.transfers?.count || 0
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs border-t-2 border-retro-primary pt-3">
                    <div className="flex items-center">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-1 text-retro-primary"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span className="text-retro-primary opacity-80">
                        Score based on liquidity, volume, community activity,
                        and risk factors
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Token stats in grid layout */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {tokenDetails.uniqueHolders && (
                  <div className=" p-3  border-2 border-retro-primary  transition-all hover:border-retro-accent">
                    <span className="text-retro-secondary text-xs font-bold block mb-1">
                      HOLDERS
                    </span>
                    <span className="text-retro-accent text-sm font-mono">
                      {tokenDetails.uniqueHolders}
                    </span>
                  </div>
                )}
                {tokenDetails.marketCap && (
                  <div className=" p-3  border-2 border-retro-primary  transition-all hover:border-retro-accent">
                    <span className="text-retro-secondary text-xs font-bold block mb-1">
                      MARKET CAP
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-retro-accent text-sm font-mono">
                        ${formatNumberWithAbbreviations(tokenDetails.marketCap)}
                      </span>
                      {tokenDetails.marketCapDelta24h && (
                        <span
                          className={`text-xs font-mono ${
                            parseFloat(tokenDetails.marketCapDelta24h) >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {parseFloat(tokenDetails.marketCapDelta24h) >= 0
                            ? "+"
                            : ""}
                          {formatNumberWithAbbreviations(
                            tokenDetails.marketCapDelta24h
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {tokenDetails.volume24h && (
                  <div className=" p-3  border-2 border-retro-primary  transition-all hover:border-retro-accent">
                    <span className="text-retro-secondary text-xs font-bold block mb-1">
                      24H VOLUME
                    </span>
                    <span className="text-retro-accent text-sm font-mono">
                      ${formatNumberWithAbbreviations(tokenDetails.volume24h)}
                    </span>
                  </div>
                )}
                {tokenDetails.totalSupply && (
                  <div className=" p-3  border-2 border-retro-primary  transition-all hover:border-retro-accent">
                    <span className="text-retro-secondary text-xs font-bold block mb-1">
                      TOTAL SUPPLY
                    </span>
                    <span className="text-retro-accent text-sm font-mono">
                      {formatNumberWithAbbreviations(tokenDetails.totalSupply)}
                    </span>
                  </div>
                )}
              </div>

              {/* Additional Token Info */}
              <div className="grid grid-cols-1 gap-2">
                {tokenDetails.totalVolume && (
                  <div className=" p-3  border-2 border-retro-primary  transition-all hover:border-retro-accent">
                    <span className="text-retro-secondary text-xs font-bold block mb-1">
                      TOTAL VOLUME
                    </span>
                    <span className="text-retro-accent text-sm font-mono">
                      ${formatNumberWithAbbreviations(tokenDetails.totalVolume)}
                    </span>
                  </div>
                )}
                {tokenDetails.createdAt && (
                  <div className=" p-3  border-2 border-retro-primary  transition-all hover:border-retro-accent">
                    <span className="text-retro-secondary text-xs font-bold block mb-1">
                      CREATED
                    </span>
                    <span className="text-retro-accent text-sm font-mono">
                      {formatDate(tokenDetails.createdAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Onchain Data Section */}
              {onchainData && !onchainData.hasError && (
                <div className="mt-4">
                  <h4 className="font-bold text-retro-primary text-xs mb-3 pixelated flex items-center">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2"
                    >
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                    ONCHAIN DATA
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {onchainData.liquidity && (
                      <div className="p-3 border-2 border-retro-primary transition-all hover:border-retro-accent">
                        <span className="text-retro-secondary text-xs font-bold block mb-1">
                          LIQUIDITY
                        </span>
                        <span className="text-retro-accent text-sm font-mono">
                          {onchainData.liquidity.formatted} ETH
                        </span>
                        {onchainData.liquidity.usdcDecimal > 0 && (
                          <span className="text-retro-secondary text-xs block">
                            ≈ ${onchainData.liquidity.usdcDecimal.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="p-3 border-2 border-retro-primary transition-all hover:border-retro-accent">
                      <span className="text-retro-secondary text-xs font-bold block mb-1">
                        OWNERS
                      </span>
                      <span className="text-retro-accent text-sm font-mono">
                        {onchainData.ownersCount || 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading state for onchain data */}
              {isLoadingOnchain && (
                <div className="mt-4 p-3 border-2 border-retro-primary text-center">
                  <div className="retro-loading mx-auto mb-2">
                    <div></div>
                    <div></div>
                    <div></div>
                  </div>
                  <p className="text-retro-secondary text-xs">
                    Loading onchain data...
                  </p>
                </div>
              )}

              {/* Comments Section */}
              <div className="mt-6">
                <h4 className="font-bold text-retro-primary text-xs mb-3 pixelated flex items-center justify-between">
                  <div className="flex items-center">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    COMMUNITY COMMENTS
                  </div>
                  {totalCommentsCount > 0 && (
                    <span className="text-retro-accent text-xs">
                      {totalCommentsCount} total
                    </span>
                  )}
                </h4>

                {isLoadingComments && comments.length === 0 ? (
                  <div className="p-4 border-2 border-retro-primary text-center">
                    <div className="retro-loading mx-auto mb-2">
                      <div></div>
                      <div></div>
                      <div></div>
                    </div>
                    <p className="text-retro-secondary text-xs">
                      Loading comments...
                    </p>
                  </div>
                ) : comments.length > 0 ? (
                  <div className="space-y-3">
                    {comments.map((comment: Comment, index: number) => (
                      <div
                        key={comment.node.txHash || index}
                        className="p-3 border border-retro-primary bg-black/20 transition-all hover:border-retro-accent"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            <div className="w-6 h-6 bg-retro-primary/20 border border-retro-primary rounded flex items-center justify-center mr-2">
                              {comment.node.userProfile.avatar?.previewImage
                                ?.small ? (
                                <img
                                  src={
                                    comment.node.userProfile.avatar.previewImage
                                      .small
                                  }
                                  alt={comment.node.userProfile.handle}
                                  className="w-full h-full rounded object-cover"
                                />
                              ) : (
                                <span className="text-retro-primary text-xs font-bold">
                                  {comment.node.userProfile.handle
                                    ?.charAt(0)
                                    ?.toUpperCase() || "?"}
                                </span>
                              )}
                            </div>
                            <span className="text-retro-accent text-xs font-mono">
                              {comment.node.userProfile.handle || "Anonymous"}
                            </span>
                          </div>
                          <span className="text-retro-secondary text-xs">
                            {comment.node.timestamp
                              ? new Date(
                                  comment.node.timestamp * 1000
                                ).toLocaleDateString()
                              : ""}
                          </span>
                        </div>
                        <p className="text-retro-accent text-xs leading-relaxed">
                          {comment.node.comment || "No comment text"}
                        </p>
                        {comment.node.replies &&
                          comment.node.replies.count > 0 && (
                            <div className="mt-2 text-retro-secondary text-xs">
                              💬 {comment.node.replies.count}{" "}
                              {comment.node.replies.count === 1
                                ? "reply"
                                : "replies"}
                            </div>
                          )}
                      </div>
                    ))}

                    {/* Load More Button */}
                    {commentsPageInfo?.hasNextPage && (
                      <div className="text-center pt-3">
                        <RetroButton
                          onClick={loadMoreComments}
                          isLoading={isLoadingComments}
                          variant="outline"
                          className="text-xs bg-transparent border-retro-primary hover:bg-retro-primary/20"
                        >
                          {isLoadingComments
                            ? "Loading..."
                            : "Load More Comments"}
                        </RetroButton>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 border-2 border-retro-primary text-center">
                    <p className="text-retro-secondary text-xs">
                      No comments yet
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "trade" && (
            <div>
              {/* User Balance Info */}
              {isConnected && (
                <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                  <div className=" p-3  border-2 border-retro-primary">
                    <span className="text-retro-secondary font-bold block mb-1">
                      YOUR ETH:
                    </span>
                    <span className="text-retro-accent font-mono text-sm">
                      {formatBalance(userEthBalance)}
                    </span>
                  </div>
                  <div className=" p-3  border-2 border-retro-primary">
                    <span className="text-retro-secondary font-bold block mb-1">
                      YOUR {tokenDetails.symbol}:
                    </span>
                    <span className="text-retro-accent font-mono text-sm">
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
                  className={`flex-1 text-xs py-3 transition-all duration-300 ${
                    tradeType === "buy"
                      ? "bg-retro-primary shadow-[0_0_10px_rgba(255,107,53,0.3)]"
                      : "bg-transparent border-retro-primary hover:bg-retro-primary/10"
                  }`}
                >
                  BUY
                </RetroButton>
                <RetroButton
                  onClick={() => handleTradeTypeChange("sell")}
                  variant={tradeType === "sell" ? "default" : "outline"}
                  className={`flex-1 text-xs py-3 transition-all duration-300 ${
                    tradeType === "sell"
                      ? "bg-retro-primary shadow-[0_0_10px_rgba(255,107,53,0.3)]"
                      : "bg-transparent border-retro-primary hover:bg-retro-primary/10"
                  }`}
                >
                  SELL
                </RetroButton>
              </div>

              <div className=" p-4  border-2 border-retro-primary mb-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="retro-label text-xs text-retro-primary font-bold pixelated">
                    {tradeType === "buy"
                      ? `ETH AMOUNT TO USE`
                      : `${tokenDetails.symbol} - AMOUNT TO SELL`}
                  </label>
                </div>

                <div className="relative mb-3">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    className={`retro-input w-full text-xs py-3 border-2 ${
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

                {/* Percentage buttons in flex layout */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[10, 25, 50, 99].map((percent) => (
                    <RetroButton
                      key={percent}
                      onClick={() => setPredefinedAmount(percent)}
                      variant={
                        selectedPurchasePercentage === percent &&
                        !isCustomAmount
                          ? "default"
                          : "outline"
                      }
                      className={`text-xs py-2 transition-all ${
                        selectedPurchasePercentage === percent &&
                        !isCustomAmount
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
                  className="w-full h-2 mb-4 appearance-none rounded-full bg-retro-primary/20 border-2 border-retro-primary"
                  style={{
                    background: `linear-gradient(to right, var(--retro-primary) 0%, var(--retro-primary) ${selectedPurchasePercentage}%, rgba(255, 107, 53, 0.1) ${selectedPurchasePercentage}%, rgba(255, 107, 53, 0.1) 100%)`,
                  }}
                />
                <div className="text-xs text-retro-accent text-center font-mono p-2 bg-black/20 border border-retro-primary">
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
                  className="text-sm bg-retro-primary hover:bg-retro-primary/90 transition-all duration-300 shadow-[0_0_10px_rgba(255,107,53,0.3)] hover:shadow-[0_0_15px_rgba(255,107,53,0.4)] border-2 border-retro-primary/70 py-4 font-bold pixelated"
                >
                  {tradeType === "buy"
                    ? `BUY ${tokenDetails.symbol} NOW`
                    : `SELL ${tokenDetails.symbol} NOW`}
                </RetroButton>
              ) : (
                <div className="text-center p-4 border-2 border-retro-primary  ">
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
                  <p className="font-semibold text-retro-primary pixelated">
                    TRADING TIPS:
                  </p>
                </div>
                <ul className="ml-5 space-y-1 list-disc">
                  <li>Received amounts may sometimes be inaccurate</li>
                  <li>Always leave some ETH for gas fees</li>
                  <li>Larger trades may have higher slippage</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "analysis" && (
            <div>
              {/* Analysis Question Input */}
              <div className="mb-4">
                <label className="text-retro-primary text-xs font-bold mb-3 pixelated flex items-center">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
                  </svg>
                  ASK ABOUT THIS TOKEN:
                </label>
                <input
                  type="text"
                  className="retro-input w-full text-xs py-3 border-2 border-retro-primary text-retro-accent bg-black/60 mb-4"
                  value={analysisQuestion}
                  onChange={(e) => setAnalysisQuestion(e.target.value)}
                  placeholder="What would you like to know about this token?"
                />

                {/* Quick Question Buttons */}
                <div className="grid grid-cols-1 gap-2 mb-4 text-xs">
                  <RetroButton
                    onClick={() =>
                      setAnalysisQuestion("Is this token a good investment?")
                    }
                    variant="outline"
                    className="text-xs py-2 bg-transparent border-retro-primary hover:bg-retro-primary/20 text-left flex items-center"
                  >
                    Is this token a good investment?
                  </RetroButton>
                  <RetroButton
                    onClick={() =>
                      setAnalysisQuestion(
                        "What are the risks of investing in this token?"
                      )
                    }
                    variant="outline"
                    className="text-xs py-2 bg-transparent border-retro-primary hover:bg-retro-primary/20 text-left flex items-center"
                  >
                    What are the risks of this token?
                  </RetroButton>
                  <RetroButton
                    onClick={() =>
                      setAnalysisQuestion(
                        "How does this token compare to similar projects?"
                      )
                    }
                    variant="outline"
                    className="text-[10px] py-2 bg-transparent border-retro-primary hover:bg-retro-primary/20 text-left flex items-center"
                  >
                    How does it compare to others?
                  </RetroButton>
                </div>
              </div>

              {/* Analysis Button */}
              <RetroButton
                onClick={handleAnalyzeToken}
                isLoading={isAnalyzing}
                fullWidth
                className="text-sm bg-retro-primary hover:bg-retro-primary/90 transition-all duration-300 shadow-[0_0_10px_rgba(255,107,53,0.3)] hover:shadow-[0_0_15px_rgba(255,107,53,0.4)] border-2 border-retro-primary/70 py-4 font-bold pixelated mb-4 flex items-center justify-center"
              >
                <svg
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
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
                {isAnalyzing ? "ANALYZING TOKEN..." : "ANALYZE TOKEN WITH AI"}
              </RetroButton>

              {/* Analysis Results */}
              {analysisResult && (
                <div className="bg-gradient-to-br from-retro-primary/15 via-retro-primary/5 to-black/40 p-4 border-2 border-retro-primary shadow-[0_0_15px_rgba(255,107,53,0.2)] rounded">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-retro-primary/20 border-2 border-retro-primary rounded flex items-center justify-center mr-3">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-retro-primary"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          />
                          <circle cx="9" cy="9" r="2" />
                          <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                      </div>
                      <div>
                        <h5 className="text-retro-primary text-sm font-bold pixelated">
                          AI ANALYSIS RESULTS
                        </h5>
                        <p className="text-retro-secondary text-xs">
                          Generated analysis for {tokenDetails.symbol}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAnalysisResult(null)}
                      className="text-retro-secondary hover:text-retro-accent transition-colors p-1 hover:bg-retro-primary/10 rounded"
                      title="Clear analysis"
                    >
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
                      >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>

                  <div className="bg-black/60 border-2 border-retro-primary rounded p-4">
                    <div className="max-h-80 overflow-y-auto font-mono text-sm leading-relaxed">
                      {formatAnalysisText(analysisResult)}
                    </div>
                  </div>

                  {/* Analysis Footer */}
                  <div className="mt-4 pt-3 border-t border-retro-primary flex items-center justify-between">
                    <div className="flex items-center text-xs text-retro-secondary">
                      <svg
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
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      Analysis based on available token data
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(analysisResult)
                        }
                        className="text-xs text-retro-accent hover:text-retro-primary transition-colors px-2 py-1 border border-retro-primary rounded hover:bg-retro-primary/10"
                      >
                        Copy
                      </button>
                      <button
                        onClick={handleAnalyzeToken}
                        className="text-xs text-retro-accent hover:text-retro-primary transition-colors px-2 py-1 border border-retro-primary rounded hover:bg-retro-primary/10"
                      >
                        Re-analyze
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Analysis Info */}
              <div className="text-xs text-retro-accent mt-4 p-3 border border-retro-primary bg-black/20">
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
                  <p className="font-semibold text-retro-primary pixelated">
                    ANALYSIS INFO:
                  </p>
                </div>
                <ul className="ml-5 space-y-1 list-disc">
                  <li>Analysis is based on available token metrics and data</li>
                  <li>Not financial advice - do your own research</li>
                  <li>Results may take a few seconds to generate</li>
                </ul>
              </div>
            </div>
          )}
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
