import { createPublicClient, http, formatEther } from "viem";
import { base } from "viem/chains";
import { getOnchainCoinDetails } from "@zoralabs/coins-sdk";
import { setApiKey } from "@zoralabs/coins-sdk";

// Initialize API key for production environments
// Uses environment variable or allows manual override
const initializeApiKey = () => {
  const apiKey = process.env.NEXT_PUBLIC_ZORA_API_KEY;
  if (apiKey) {
    setApiKey(apiKey);
    console.log("Zora API key initialized from environment variables");
  } else {
    console.warn("Zora API key not found in environment variables");
  }
};

// Call initialization on module load
initializeApiKey();

// Use RPC URL from environment variables or default to Base RPC
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://mainnet.base.org";

// Create Viem public client
export const getPublicClient = () => {
  return createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });
};

/**
 * Safely format BigInt values to ETH strings
 * @param {any} value - Value to format
 * @returns {string} Formatted ETH value
 */
const safeFormatEther = (value) => {
  if (value === undefined || value === null) return "0";
  
  // Handle BigInt values directly (as per SDK documentation)
  try {
    if (typeof value === 'bigint') {
      return formatEther(value);
    }
    
    // Handle string representation of BigInt
    if (typeof value === 'string' && value !== "0") {
      return formatEther(BigInt(value));
    }
    
    return "0";
  } catch (error) {
    console.warn("formatEther error:", error, "value:", value);
    return "0";
  }
};

/**
 * Format onchain detail values for safe serialization
 * @param {any} detail - Detail value to format (BigInt according to SDK docs)
 * @returns {object} Formatted detail object
 */
const formatOnchainDetail = (detail) => {
  if (!detail) return { raw: "0", formatted: "0" };
  
  // According to SDK docs, values are BigInt
  return {
    raw: detail.toString(),
    formatted: safeFormatEther(detail)
  };
};

/**
 * Fetch token details from blockchain
 * @param {string} tokenAddress - Token contract address
 * @param {string} userAddress - Optional user address for balance info
 * @returns {Promise<object>} Token details from blockchain
 */
export const getOnchainTokenDetails = async (tokenAddress, userAddress = null) => {
  if (!tokenAddress) {
    console.warn("Token address is required for onchain data");
    return null;
  }
  
  try {
    const publicClient = getPublicClient();
    
    // Use Zora SDK to fetch coin data from blockchain
    // Format according to SDK documentation
    const params = {
      coin: tokenAddress,
      publicClient,
      ...(userAddress ? { user: userAddress } : {})
    };
    
    console.log("Fetching onchain details for:", tokenAddress);
    const details = await getOnchainCoinDetails(params);
    console.log("Raw onchain details received:", details);
    
    // Format according to SDK documentation structure
    const tokenDetails = {
      address: details.address || tokenAddress,
      name: details.name || "Unknown Token",
      symbol: details.symbol || "???",
      decimals: details.decimals || 18,
      totalSupply: formatOnchainDetail(details.totalSupply),
      pool: details.pool || "0x0000000000000000000000000000000000000000",
      owners: details.owners || [],
      ownersCount: details.owners?.length || 0,
      marketCap: formatOnchainDetail(details.marketCap),
      liquidity: formatOnchainDetail(details.liquidity),
      payoutRecipient: details.payoutRecipient || "0x0000000000000000000000000000000000000000",
      // Add user balance if available
      ...(details.balance ? {
        userBalance: formatOnchainDetail(details.balance)
      } : {}),
      // Metadata
      fetchedAt: new Date().toISOString(),
      hasError: false
    };
    
    console.log("Formatted onchain token details:", tokenDetails);
    return tokenDetails;
    
  } catch (error) {
    console.error("Error fetching onchain data:", error);
    
    // Return error object instead of throwing - allows graceful degradation
    return {
      address: tokenAddress,
      name: "Error Loading",
      symbol: "???",
      decimals: 18,
      totalSupply: {
        raw: "0",
        formatted: "0"
      },
      pool: "0x0000000000000000000000000000000000000000",
      owners: [],
      ownersCount: 0,
      marketCap: {
        raw: "0",
        formatted: "0"
      },
      liquidity: {
        raw: "0",
        formatted: "0"
      },
      payoutRecipient: "0x0000000000000000000000000000000000000000",
      fetchedAt: new Date().toISOString(),
      hasError: true,
      error: error.message
    };
  }
};

/**
 * Get formatted liquidity information
 * @param {object} onchainData - Onchain token data
 * @returns {object} Formatted liquidity info
 */
export const getLiquidityInfo = (onchainData) => {
  if (!onchainData?.liquidity) return null;
  
  const liquidity = onchainData.liquidity;
  return {
    ethAmount: liquidity.formatted || "0",
    raw: liquidity.raw || "0",
    hasLiquidity: parseFloat(liquidity.formatted || "0") > 0
  };
};

/**
 * Get formatted market cap information
 * @param {object} onchainData - Onchain token data
 * @returns {object} Formatted market cap info
 */
export const getMarketCapInfo = (onchainData) => {
  if (!onchainData?.marketCap) return null;
  
  const marketCap = onchainData.marketCap;
  return {
    ethAmount: marketCap.formatted || "0",
    raw: marketCap.raw || "0",
    hasValue: parseFloat(marketCap.formatted || "0") > 0
  };
};

/**
 * Calculate price per token from market cap and supply
 * @param {object} onchainData - Onchain token data
 * @returns {object} Price information
 */
export const getTokenPrice = (onchainData) => {
  if (!onchainData?.marketCap || !onchainData?.totalSupply) {
    return {
      ethPrice: "0",
      hasPrice: false
    };
  }
  
  try {
    const marketCapEth = parseFloat(onchainData.marketCap.formatted || "0");
    const totalSupply = parseFloat(onchainData.totalSupply.formatted || "0");
    
    if (totalSupply === 0) return { ethPrice: "0", hasPrice: false };
    
    const ethPrice = marketCapEth / totalSupply;
    
    return {
      ethPrice: ethPrice.toFixed(8),
      hasPrice: ethPrice > 0
    };
  } catch (error) {
    console.error("Error calculating token price:", error);
    return {
      ethPrice: "0",
      hasPrice: false
    };
  }
}; 