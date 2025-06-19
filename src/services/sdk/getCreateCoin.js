/**
 * @fileoverview Service functions for creating Zora coins
 * @module createCoin
 */

import { createCoin, validateMetadataURIContent, getCoinCreateFromLogs, DeployCurrency } from "@zoralabs/coins-sdk";
import { base } from 'viem/chains';
import { toast } from 'react-hot-toast';

/**
 * Creates a Zora coin using the updated SDK's createCoin function
 * @param {Object} params - Coin creation parameters
 * @param {string} params.name - Name of the coin
 * @param {string} params.symbol - Trading symbol for the coin
 * @param {string} params.uri - Metadata URI (IPFS URI recommended)
 * @param {string} params.payoutRecipient - Address that receives creator earnings
 * @param {Array<string>} [params.owners] - Optional array of owner addresses
 * @param {bigint} [params.initialPurchaseWei] - Optional initial purchase amount (for backward compatibility)
 * @param {string} [params.platformReferrer] - Optional platform referrer address for earning referral fees
 * @param {DeployCurrency} [params.currency] - Optional currency (DeployCurrency.ETH or DeployCurrency.ZORA)
 * @param {number} [params.chainId] - Optional chain ID (defaults to current wallet chain)
 * @param {Object} walletClient - Viem wallet client
 * @param {Object} publicClient - Viem public client
 * @returns {Promise<object>} Transaction result with hash, receipt, and coin address
 */
export async function createZoraCoin({
  name,
  symbol,
  uri,
  payoutRecipient,
  owners = [],
  initialPurchaseWei = 0n,
  platformReferrer,
  currency,
  chainId
}, walletClient, publicClient) {
  try {
    if (!name || !symbol || !uri || !payoutRecipient) {
      throw new Error("Required parameters missing: name, symbol, uri, and payoutRecipient are required");
    }
    
    if (!walletClient || !publicClient) {
      throw new Error("Wallet client and public client are required");
    }

    // Validate metadata URI content before creating the coin
    try {
      console.log("Validating metadata URI:", uri);
      await validateMetadataURIContent(uri);
      console.log("✅ Metadata URI validation successful");
    } catch (validationError) {
      console.error("❌ Metadata URI validation failed:", validationError);
      throw new Error(`Invalid metadata URI: ${validationError.message}`);
    }

    // Get wallet chain ID or use provided chainId
    const walletChainId = await walletClient.getChainId();
    const targetChainId = chainId || walletChainId;
    
    // Validate Base network (optional - remove if you want to support other chains)
    if (targetChainId === base.id && walletChainId !== base.id) {
      toast.error(`You're connected to network ID ${walletChainId}, but Base network (${base.id}) is required. Please switch networks.`, { 
        id: "network-error", 
        duration: 5000 
      });
      
      throw new Error(`Chain mismatch: Connected to chain ${walletChainId}, but Base (${base.id}) is required. Please switch networks.`);
    }

    // Determine currency - use DeployCurrency enum from SDK
    let selectedCurrency = currency;
    if (selectedCurrency === undefined || selectedCurrency === null) {
      // Default based on chain as per documentation
      if (targetChainId === base.id) {
        selectedCurrency = DeployCurrency.ETH; // Using ETH as default for better compatibility
      } else {
        selectedCurrency = DeployCurrency.ETH; // ETH is default on other chains
      }
    }
    
    console.log("Selected currency:", selectedCurrency === DeployCurrency.ZORA ? "ZORA" : "ETH");
    
    // Prepare coin parameters according to latest SDK docs format
    const coinParams = {
        name,
        symbol,
        uri,
        payoutRecipient,
      currency: selectedCurrency, // Use DeployCurrency enum from SDK
      ...(owners && owners.length > 0 && { owners }), // Only include owners if provided
      ...(platformReferrer && { platformReferrer }) // Only include platformReferrer if provided
    };
    
    // Include chainId only if it's different from the current wallet chain
    if (chainId && chainId !== walletChainId) {
      coinParams.chainId = chainId;
    }
    
    console.log("Creating coin with SDK parameters:", {
      ...coinParams,
      currencyType: selectedCurrency === DeployCurrency.ZORA ? "ZORA" : "ETH",
      initialPurchaseWei: initialPurchaseWei.toString()
    });

    // Use the SDK's createCoin function with proper options
    const result = await createCoin(
      coinParams,
      walletClient,
      publicClient,
      {
        gasMultiplier: 120, // Add 20% buffer to gas (recommended)
        // For ETH currency with initial purchase, SDK should handle value automatically
      }
    );

    console.log("Coin created successfully with SDK:", {
      hash: result.hash,
      address: result.address,
      deployment: result.deployment
    });

    return result;
  } catch (error) {
    console.error("Error creating coin:", error);
    
    // Provide more specific error messages
    if (error.message && error.message.includes("execution reverted")) {
      throw new Error("Contract execution failed. This might be due to insufficient funds, invalid parameters, or network congestion. Please try again with a higher gas limit or check your wallet balance.");
    } else if (error.message && error.message.includes("user rejected")) {
      throw new Error("Transaction was rejected by user");
    } else if (error.message && error.message.includes("insufficient funds")) {
      throw new Error("Insufficient funds for transaction including gas fees");
    } else if (error.message && error.message.includes("Invalid metadata URI")) {
      throw new Error(`Metadata validation failed: ${error.message}`);
    } else {
      throw new Error(`Failed to create coin: ${error.message}`);
    }
  }
} 

/**
 * Helper function to get coin address from transaction receipt logs
 * @param {Object} receipt - Transaction receipt
 * @returns {string|null} Deployed coin address or null if not found
 */
export function getCoinAddressFromReceipt(receipt) {
  try {
    const coinDeployment = getCoinCreateFromLogs(receipt);
    return coinDeployment?.coin || null;
  } catch (error) {
    console.error("Error extracting coin address from receipt:", error);
    return null;
  }
}

// Export the DeployCurrency enum from the SDK for consistency
export { DeployCurrency }; 