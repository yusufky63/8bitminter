import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useConnect, useWalletClient, usePublicClient, useSwitchChain } from "wagmi";
import { toast } from "react-hot-toast";
import { parseEther } from "viem";
import { base } from "viem/chains";
import { detectEnvironment, getPreferredConnectorId, isWalletAvailable, getWalletAvailabilityMessage, isTrustedFarcasterHost, hasFarcasterRuntime, type AppEnvironment } from '../utils/wallet';
import { runWalletDiagnostics, testWalletConnections } from '../utils/walletTest';

// Retro components
import { RetroSteps } from "./ui/RetroSteps";
import { RetroIntro } from "./RetroIntro";
import { RetroCategories } from "./RetroCategories";
import { RetroTokenDetails } from "./RetroTokenDetails";
import { RetroMint } from "./RetroMint";
import { RetroSuccess } from "./RetroSuccess";
import { RetroNotification } from "./RetroNotification";

// Services
import { getCoinCategories } from "../services/aiService.js";
// Moved IPFS pinning to server route to avoid CORS with Together links
import { createZoraCoin, getCoinAddressFromReceipt, DeployCurrency } from "../services/sdk/getCreateCoin.js";
import { CoinService, type CreateCoinData } from "../services/coinService";

// Type definitions
// Type definitions
interface FormData {
  category: string;
  description: string;
  name: string;
  symbol: string;
  imageUrl: string;
}

type CategoryItem = {
  name: string;
  features: string; 
  themes: string;
};

interface AiSuggestion {
  name: string;
  symbol: string;
  description: string;
  category?: string;
  features?: string;
}

interface FarcasterSDK {
  actions: {
    ready: () => Promise<void>;
  };
  events?: {
    on: (event: string, callback: () => void) => void;
    off?: (event: string, callback: () => void) => void;
  };
  wallet?: {
    ethProvider: {
      request: (args: { method: string }) => Promise<string[]>
    }
  };
  context?: {
    user?: {
      fid?: number;
      username?: string;
      displayName?: string;
      pfp?: {
        url?: string;
      };
    };
    client?: {
      safeAreaInsets?: {
        top: number;
        bottom: number;
        left: number;
        right: number;
      }
    }
  };
}

interface CoinCreationResult {
  hash: string;
  address?: string;
  receipt?: {
    blockHash?: string;
    blockNumber?: bigint;
    contractAddress?: string;
    status?: string;
    transactionHash?: string;
    logs?: unknown[];
    [key: string]: unknown;
  };
  deployment?: {
    [key: string]: unknown;
  };
}


export default function RetroCoinCreator() {
  // Basic state
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isContentReady, setIsContentReady] = useState(false);
  const sdkInitialized = useRef(false);
  const farcasterSDK = useRef<FarcasterSDK | null>(null);
  const randomCategoryInitialized = useRef(false);
  const [appEnv, setAppEnv] = useState<AppEnvironment>(() =>
    typeof window !== 'undefined' ? detectEnvironment() : 'unknown'
  );
  
  // Form state
  const [formData, setFormData] = useState<FormData>({
    category: "",
    description: "",
    name: "",
    symbol: "",
    imageUrl: ""
  });
  
  // Purchase amount state
  const [selectedPurchaseAmount, setSelectedPurchaseAmount] = useState<string>("0.01");
  const [selectedPurchasePercentage, setSelectedPurchasePercentage] = useState<number>(10);
  const [userEthBalance, setUserEthBalance] = useState<bigint>(BigInt(0));
  const [ethToUsdRate, setEthToUsdRate] = useState<number>(0);
  const [isCustomAmount, setIsCustomAmount] = useState<boolean>(false);
  const [isPurchaseEnabled, setIsPurchaseEnabled] = useState<boolean>(false);
  const [ownersAddresses, setOwnersAddresses] = useState<string[]>([]);
  const [newOwnerAddress, setNewOwnerAddress] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<number>(DeployCurrency.ZORA);
  const [platformReferrer, setPlatformReferrer] = useState<string>("0xbFA6A45Dd534d39dF47A3F3D2f2b6E88416f9831");
  
  // AI generations
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [creatingImage, setCreatingImage] = useState(false);
  
  // Display states
  const [displayImageUrl, setDisplayImageUrl] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [autoCreateAfterConnect, setAutoCreateAfterConnect] = useState<boolean>(false);
  
  // Wallet connection
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const isWalletReady = Boolean(isConnected && walletClient && publicClient);
  const uiIsConnected = isConnected || appEnv === 'farcaster' || appEnv === 'baseapp';

  // Create concise error messages for user-facing notifications
  const simplifyErrorMessage = (raw: string) => {
    const msg = (raw || '').toLowerCase();
    if (msg.includes('not been authorized') || msg.includes('unauthorized') || msg.includes('not authorized')) {
      return 'Authorization required in wallet.';
    }
    if (msg.includes('user rejected') || msg.includes('denied')) {
      return 'Transaction cancelled by user.';
    }
    if (msg.includes('insufficient funds')) {
      return 'Insufficient funds.';
    }
    if (msg.includes('chain mismatch') || (msg.includes('switch') && msg.includes('chain')) || msg.includes('wrong network')) {
      return 'Wrong network. Switch to Base.';
    }
    if (msg.includes('network') || msg.includes('rpc')) {
      return 'Network error. Try again.';
    }
    if (msg.includes('metadata')) {
      return 'Invalid metadata URI.';
    }
    if (msg.includes('timeout')) {
      return 'Request timed out.';
    }
    // fallback to first sentence, capped
    const firstLine = raw.split('\n')[0] || raw;
    return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
  };

  // Debug environment and connectors
  useEffect(() => {
    const env = detectEnvironment();
    setAppEnv(env);
    console.log('Current environment:', env);
    console.log('Available connectors:', connectors?.map(c => ({ id: c.id, name: c.name })));
    console.log('Wallet available:', isWalletAvailable());
    
    // Run full diagnostics
    runWalletDiagnostics();
    
    // Test wallet connections in development
    if (process.env.NODE_ENV === 'development') {
      testWalletConnections();
    }

    // Attempt silent auto-connect in Farcaster/BaseApp frames, only from trusted hosts and when runtime exists
    try {
      if ((env === 'farcaster' || env === 'baseapp') && isTrustedFarcasterHost() && hasFarcasterRuntime() && !isConnected && connectors && connectors.length > 0) {
        // Prefer any connector that looks like Farcaster/Frame
        const farcasterLike = connectors.find((c) =>
          (c.id?.toLowerCase?.() || '').includes('farcaster') ||
          (c.id?.toLowerCase?.() || '').includes('frame') ||
          (c.name?.toLowerCase?.() || '').includes('farcaster') ||
          (c.name?.toLowerCase?.() || '').includes('frame')
        );

        if (farcasterLike) {
          try {
            connect({ connector: farcasterLike });
          } catch {
            // swallow errors
          }
        }
      }
    } catch (_) {
      // no-op; auto connect best-effort only
    }
  }, [connectors]);

  // Get ETH price in USD with cache
  const ethPriceCache: { value: number | null, timestamp: number } = { value: null, timestamp: 0 };
  const CACHE_DURATION_MS = 60 * 1000; // 1 minute

  const fetchEthPrice = useCallback(async () => {
    const now = Date.now();
    if (
      ethPriceCache.value !== null &&
      now - ethPriceCache.timestamp < CACHE_DURATION_MS
    ) {
      setEthToUsdRate(ethPriceCache.value);
      return;
    }
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      if (data && data.ethereum && data.ethereum.usd) {
        ethPriceCache.value = data.ethereum.usd;
        ethPriceCache.timestamp = now;
        setEthToUsdRate(data.ethereum.usd);
      }
    } catch (error) {
      console.error("Failed to fetch ETH price:", error);
      // Use fallback price if API fails
      setEthToUsdRate(3000);
    }
  }, []);

  // Update user's ETH balance
  const updateUserBalance = useCallback(async () => {
    if (isConnected && address && publicClient) {
      try {
        const balance = await publicClient.getBalance({ address });
        setUserEthBalance(balance);
        console.log(`User ETH balance: ${balance} wei (${Number(balance) / 10**18} ETH)`);
      } catch (error) {
        console.error("Failed to get user balance:", error);
      }
    }
  }, [isConnected, address, publicClient]);

  // Calculate purchase amount based on percentage of balance
  const calculatePurchaseAmount = useCallback((percentage: number): string => {
    if (userEthBalance === BigInt(0)) return "0.001";
    
    // Calculate percentage of balance (leave some for gas)
    const maxUsableBalance = userEthBalance * BigInt(90) / BigInt(100); // Use max 90% of balance to leave gas
    const amount = maxUsableBalance * BigInt(percentage) / BigInt(100);
    
    // Convert to ETH (with 5 decimal places)
    const ethAmount = Number(amount) / 10**18;
    
    // Ensure minimum amount of 0.001 ETH
    const finalAmount = Math.max(ethAmount, 0.001);
    
    // Format to 5 decimal places max
    return finalAmount.toFixed(5);
  }, [userEthBalance]);

  // Set predefined amount with 1% slippage margin for 100%
  const setPredefinedAmount = (percentage: number) => {
    // If requesting 100%, actually use 99% to leave room for gas (1% slippage)
    const actualPercentage = percentage === 100 ? 99 : percentage;
    setSelectedPurchasePercentage(actualPercentage);
    setIsCustomAmount(false);
  };

  // Handle custom amount change
  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSelectedPurchaseAmount(value);
    setIsCustomAmount(true);
  };

  // Add owner address
  const addOwnerAddress = () => {
    if (newOwnerAddress && !ownersAddresses.includes(newOwnerAddress)) {
      setOwnersAddresses([...ownersAddresses, newOwnerAddress]);
      setNewOwnerAddress("");
    }
  };

  // Remove owner address
  const removeOwnerAddress = (address: string) => {
    setOwnersAddresses(ownersAddresses.filter(item => item !== address));
  };

  // Update purchase amount when slider changes, only if not in custom mode
  useEffect(() => {
    if (!isCustomAmount) {
      const newAmount = calculatePurchaseAmount(selectedPurchasePercentage);
      setSelectedPurchaseAmount(newAmount);
    }
  }, [selectedPurchasePercentage, calculatePurchaseAmount, isCustomAmount]);

  // Fetch ETH price and user balance
  useEffect(() => {
    fetchEthPrice();
    updateUserBalance();
    
    // Refresh price every 5 minutes
    const priceInterval = setInterval(fetchEthPrice, 300000);
    
    return () => clearInterval(priceInterval);
  }, [fetchEthPrice, updateUserBalance]);

  // Update balance when wallet connection changes
  useEffect(() => {
    updateUserBalance();
  }, [isConnected, address, updateUserBalance]);

  // Generate AI suggestions for token name and description
  const generateAiSuggestions = useCallback(async () => {
    console.log(" generateAiSuggestions called with:", {
      category: formData.category,
      description: formData.description
    });
    
    if (!formData.category || !formData.description) {
      console.warn(" Missing category or description");
      setError("Please select a category and provide a description");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    // Show processing toast
    toast.loading("Analyzing token data...", { id: 'status-toast' });
    
    try {
      // Use full URL to avoid relative URL issues
      const apiUrl = `${window.location.origin}/api/ai`;
      console.log(" Sending request to:", apiUrl);
      
      // Timeout controller kaldÄ±rÄ±ldÄ± - backend ile uyumlu sÄ±nÄ±rsÄ±z bekleme
      // const controller = new AbortController();
      // const timeoutId = setTimeout(() => {
      //   controller.abort();
      //   console.warn(" Request timeout triggered");
      // }, 25000); // Increased timeout
      
      try {
        console.log(" Request payload:", {
          action: "text",
          category: formData.category,
          description: formData.description
        });
        
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "text",
            category: formData.category,
            description: formData.description
          }),
          // signal: controller.signal
        });
        
        // clearTimeout(timeoutId);
        console.log(" Response status:", response.status);
        
        if (!response.ok) {
          // Detailed error messages
          const statusCode = response.status;
          let errorMessage = `API error: ${statusCode}`;
          
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            console.error(" AI API error:", errorData);
          } catch (_) {
            // JSON parsing failed, use text
            const errorText = await response.text();
            console.error(" AI API error text:", errorText);
          }
          
          throw new Error(errorMessage);
        }
        
        // Try to parse the response
        let data;
        try {
          data = await response.json();
          console.log(" AI response data:", data);
        } catch (parseError) {
          console.error(" Failed to parse JSON response:", parseError);
          throw new Error("Invalid response format from AI service");
        }
        
        if (!data || !data.name || !data.symbol || !data.description) {
          console.error(" Invalid AI response - missing fields:", data);
          throw new Error("Invalid response from AI service - missing required fields");
        }
        
        // Success - update state
        console.log(" Setting AI suggestion:", data);
        setAiSuggestion(data);
        
        // Populate form with AI suggestions
        console.log(" Updating form data with AI suggestions");
        setFormData({
          ...formData,
          name: data.name || formData.name,
          symbol: data.symbol || formData.symbol,
          description: data.description || formData.description // AI tarafÄ±ndan oluÅŸturulan description'Ä± formData'ya kaydet
        });
        
        // Success toast
        toast.success("Analysis complete! Token details generated", { id: 'status-toast' });
        
        // Move to next step
        console.log(" Moving to next step");
        setStep(2);
      } catch (fetchError: unknown) {
        // clearTimeout(timeoutId);
        
        console.error(" Fetch error:", fetchError);
        
        if (fetchError && typeof fetchError === 'object' && 'name' in fetchError && fetchError.name === 'AbortError') {
          toast.error("Request timed out. Please try again.", { id: 'status-toast' });
          throw new Error("Request to AI service timed out. Please try again.");
        }
        
        // Network error check
        if (fetchError && typeof fetchError === 'object' && 'message' in fetchError && 
            typeof fetchError.message === 'string' && fetchError.message.includes('NetworkError')) {
          toast.error("Network error. Please check your connection.", { id: 'status-toast' });
          throw new Error("Network error connecting to AI service. Please check your internet connection.");
        }
        
        toast.error("Failed to analyze token data", { id: 'status-toast' });
        throw fetchError;
      }
    } catch (error) {
      console.error(" Error generating AI suggestions:", error);
      setError(`Failed to generate AI suggestions: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`, { id: 'status-toast' });
    } finally {
      setIsLoading(false);
    }
  }, [formData, setFormData, setAiSuggestion, setError, setIsLoading, setStep]);

  // Listen for custom events from RetroCategories component
  useEffect(() => {
    // Define event handler for AI data ready event
    const handleAiDataReady = (event: CustomEvent) => {
      console.log("Received AI data event:", event.detail);
      
      try {
        const data = event.detail;
        if (!data || !data.name || !data.symbol || !data.description) {
          console.warn("Received invalid AI data in event");
          return;
        }
        
        // Update state with AI suggestions
          console.log(" Setting AI suggestion from event:", data);
        setAiSuggestion(data);
        
        // Update form data with AI suggestions
        console.log(" Updating form data with AI suggestions from event");
        setFormData(prev => ({
          ...prev,
          name: data.name || prev.name,
          symbol: data.symbol || prev.symbol
        }));
        
        // Move to the next step
        console.log(" Moving to next step from event handler");
        setStep(2);
      } catch (error) {
        console.error("Error processing AI data from event:", error);
      }
    };
    
    // Register event listener
    if (typeof window !== 'undefined') {
      window.addEventListener('ai-data-ready', handleAiDataReady as EventListener);
    }
    
    // Clean up listener on component unmount
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('ai-data-ready', handleAiDataReady as EventListener);
      }
    };
  }, [setAiSuggestion, setFormData, setStep]);
  


  // Generate token image with AI
  const generateTokenImage = useCallback(async () => {
    if (isLoading) return;
    
    // Reset image state
    setCreatingImage(true);
    setDisplayImageUrl("");
    setError("");
    
    // Validate required fields
    if (!formData.name || !formData.symbol) {
      setError("Name and symbol are required to generate an image");
      setCreatingImage(false);
      return;
    }
    
    console.log("Starting image generation for token:", formData.name);
    
    // Use AI-generated description if available, otherwise fall back to user description
    const imageDescription = aiSuggestion?.description || formData.description;
    console.log("Using description for image generation:", imageDescription);
    console.log("AI suggestion:", aiSuggestion);
    
    // Track retries
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;
    
    // Set initial loading state
    setIsLoading(true);
    setError("");
    
    try {
      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          // Display attempt information if retrying
          if (attempts > 1) {
            toast.loading(`Retrying image generation (attempt ${attempts}/${maxAttempts})...`, {
              id: 'status-toast'
            });
          } else {
            toast.loading("Generating token image...", {
              id: 'status-toast'
            });
          }
          
          // Call the image generation API with AI-enhanced description
          const response = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "image",
              name: formData.name,
              symbol: formData.symbol,
              description: imageDescription, // Use AI-enhanced description
            }),
            // Timeout kaldırıldı - sınırsız bekleme süresi backend ile uyumlu
            // signal: AbortSignal.timeout(30000) // 30 second timeout
          });
          
          // Check response status
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || `Server error: ${response.status}`;
            throw new Error(errorMessage);
          }
          
          // Parse response data
          const data = await response.json();
          
          // Check for image URL in response
          if (!data.imageUrl) {
            throw new Error("No image URL returned from API");
          }
          
          console.log("Image generation API response:", data);
          
          // API'den gelen URL'yi doğrudan kullanarak metadata yarat ve IPFS'e yükle
          console.log("Processing image URL through IPFS...");
          toast.loading("Uploading to IPFS...", { id: 'status-toast' });
          
          try {
            // Together.ai URL'sinden metadata yarat ve IPFS'e yükle
            // Pin image on server (avoids CORS limits on Together short links)
            const ipfsResp = await fetch("/api/ipfs/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageUrl: data.imageUrl,
                name: formData.name,
                symbol: formData.symbol,
                description: aiSuggestion?.description || formData.description,
              }),
            });
            if (!ipfsResp.ok) {
              const err = await ipfsResp.json().catch(() => ({}));
              throw new Error(err.error || `IPFS upload route error: ${ipfsResp.status}`);
            }
            const processedImage = await ipfsResp.json();
          
            // Update form data with IPFS URI
            setFormData(prev => ({
              ...prev,
                imageUrl: processedImage.ipfsUrl
            }));
          
            // Set display URL for UI
            setDisplayImageUrl(processedImage.displayUrl);
              
            toast.success("Image metadata uploaded to IPFS successfully!", { 
              id: 'status-toast'
            });
              
            console.log("IPFS process completed successfully");
          
            // Move to next step automatically
            setStep(3);
              
            // Success! Break out of retry loop
            return;
          } catch (ipfsError) {
            console.error("Failed to process image through IPFS:", ipfsError);
            throw new Error(`Failed to upload to IPFS: ${ipfsError instanceof Error ? ipfsError.message : "Unknown error"}`);
          }
        } catch (error) {
          lastError = error;
          console.error(`Image generation attempt ${attempts} failed:`, error);
          
          // Show appropriate toast based on attempt status
          if (attempts < maxAttempts) {
            toast.error(`Attempt ${attempts} failed, retrying...`, { id: 'status-toast' });
            // Wait before retry (rate limit için daha uzun bekleme)
            const waitTime = error instanceof Error && error.message.includes("Rate limit") ? 5000 : 2000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            // Final attempt failed
            toast.error(`Image generation failed after ${maxAttempts} attempts`, { id: 'status-toast' });
            setError(`Failed to generate image after ${maxAttempts} attempts: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }
      }
    } finally {
      // Only clear loading states when ALL attempts are complete
      setIsLoading(false);
      setCreatingImage(false);
    }
  }, [formData, isLoading, aiSuggestion]);

  // Handle coin creation
  const handleCreateCoin = useCallback(async () => {
    console.log("Creating coin with data:", formData);
    
    // Implementation for token creation
    setIsLoading(true);
    setError("");
    
    // Check if wallet is connected first
    if (!isConnected) {
      setError("Wallet connection required. Please connect your wallet first.");
      setIsLoading(false);
      return;
    }
    
    // Check if we have all required data
    if (!formData.name || !formData.symbol || !formData.description || !formData.imageUrl) {
      setError("All token details are required.");
      setIsLoading(false);
      return;
    }

    // Check wallet client - using hooks from component level
    if (!walletClient || !publicClient) {
      setError("Wallet client is not available. Please connect your wallet first.");
      setIsLoading(false);
      return;
    }

    // Additional check for wallet connection
    if (!isConnected || !address) {
      setError("Please connect your wallet first.");
      setIsLoading(false);
      return;
    }

    try {
      // Check if we're on the Base network and auto-switch if needed
      const chainId = await walletClient.getChainId();
      if (chainId !== base.id) {
        console.log(`Currently on network ${chainId}, switching to Base network (${base.id})`);
        
        try {
          // Attempt to switch to Base network
          toast.loading("Switching to Base network...", { id: 'network-switch' });
          
          await switchChain({ chainId: base.id });
          
          toast.success("Successfully switched to Base network", { id: 'network-switch' });
          
          // Wait a moment for the switch to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verify the switch was successful
          const newChainId = await walletClient.getChainId();
          if (newChainId !== base.id) {
            throw new Error("Network switch failed");
          }
          
        } catch (switchError) {
          console.error("Auto network switch failed:", switchError);
          
          const errorMessage = switchError instanceof Error ? switchError.message : "Unknown error";
          
          if (errorMessage.includes("rejected") || errorMessage.includes("denied")) {
            setError("Network switch was rejected. Please manually switch to Base network in your wallet.");
          } else {
            setError(`Failed to switch to Base network automatically. Please manually switch to Base network (ID: ${base.id}) in your wallet and try again.`);
          }
          
          toast.error("Please switch to Base network manually", { id: 'network-switch', duration: 5000 });
          setIsLoading(false);
          return;
        }
      }

      // Get user address
      const [walletAddress] = await walletClient.getAddresses();
      if (!walletAddress) {
        throw new Error("No wallet address available");
      }
      
      console.log("Creating coin on Base network with address:", walletAddress);
      
      // Skip balance check if purchase is disabled
      if (isPurchaseEnabled) {
        // Check user's balance before proceeding
        const balance = await publicClient.getBalance({ address: walletAddress });
        console.log(`Wallet balance: ${balance} wei`);
        
        // Get user's selected purchase amount
        const purchaseAmount = parseEther(selectedPurchaseAmount);
        console.log(`User selected purchase amount: ${purchaseAmount} wei`);
        
        // Minimum amount needed for the transaction (purchase amount + minimal gas buffer)
        const gasBuffer = parseEther("0.00005"); // Reduced gas buffer to 0.00005 ETH
        const minimumRequired = purchaseAmount + gasBuffer;
        
        // Check if user has enough balance for transaction
        if (balance < minimumRequired) {
          setError(`Insufficient funds. You need at least ${Number(minimumRequired) / 10**18} ETH (${selectedPurchaseAmount} ETH + gas), but your wallet only has ${Number(balance) / 10**18} ETH.`);
          toast.error("Not enough ETH in your wallet to create a coin", { 
            id: 'status-toast',
            duration: 4000 
          });
          setIsLoading(false);
          return;
        }
      }
      
      // Show a loading toast for the creation process
      toast.loading("Creating your coin - this may take a moment...", {
        id: 'status-toast',
        duration: 10000
      });
      
      // Create Zora coin using updated SDK with the IPFS URI
      console.log("Creating coin with URI:", formData.imageUrl);
      console.log("Using currency:", selectedCurrency === DeployCurrency.ZORA ? "ZORA" : "ETH");
      
        const result = await createZoraCoin({
          name: formData.name,
          symbol: formData.symbol,
          uri: formData.imageUrl,
          payoutRecipient: walletAddress,
          currency: selectedCurrency, // Use selected currency (ZORA or ETH)
          chainId: chainId, // Include current chain ID
          platformReferrer: platformReferrer || undefined, // Optional platform referrer
          owners: ownersAddresses.length > 0 ? ownersAddresses : undefined,
          // Use initial purchase as specified by user
          initialPurchaseWei: isPurchaseEnabled ? parseEther(selectedPurchaseAmount) : BigInt(0)
        }, walletClient, publicClient) as CoinCreationResult;
        
        console.log("Token created successfully:", result);
        
        // Update toast with success
        toast.success("Coin created successfully!", {
          id: 'status-toast'
        });
        
        // Set the contract address from the result or extract from receipt
        let contractAddress = "";
        if (result && typeof result === 'object' && 'address' in result && result.address) {
          contractAddress = result.address;
        } else if (result && result.receipt) {
          // Try to extract address from transaction receipt logs using new helper
          const extractedAddress = getCoinAddressFromReceipt(result.receipt);
          contractAddress = extractedAddress || "Contract created, address unknown";
        } else {
          console.warn("Contract address not found in result:", result);
          contractAddress = "Contract created, address unknown";
        }
        
        setContractAddress(contractAddress);
        
        // Save coin to database after successful creation
        if (contractAddress && contractAddress !== "Contract created, address unknown") {
          try {
            toast.loading("Saving coin to database...", { id: 'save-toast' });
            
            const coinData: CreateCoinData = {
              name: formData.name,
              symbol: formData.symbol,
              description: formData.description,
              contract_address: contractAddress,
              image_url: formData.imageUrl,
              category: formData.category,
              creator_address: walletAddress,
              creator_name: walletAddress, // You can enhance this with actual user names later
              tx_hash: result.hash,
              chain_id: chainId,
              currency: selectedCurrency === DeployCurrency.ZORA ? 'ZORA' : 'ETH',
              platform_referrer: platformReferrer || undefined,
            };
            
            const savedCoin = await CoinService.saveCoin(coinData);
            
            if (savedCoin) {
              toast.success("Coin saved to database successfully!", { id: 'save-toast' });
            } else {
              toast.error("Failed to save coin to database", { id: 'save-toast' });
              console.error(" Failed to save coin to database");
            }
          } catch (error) {
            console.error(" Error saving coin to database:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Database error: ${errorMessage}`, { id: 'save-toast' });
          }
        }
        
        // Set success message
        setSuccess(`Coin ${formData.name} (${formData.symbol}) created successfully on Base network!`);
        
        // Move to the next step
        setStep(4);
      } catch (error) {
        console.error("Error creating coin:", error);
        const raw = error instanceof Error ? error.message : String(error || '');
        const msg = raw.toLowerCase();

        // Short, user-friendly messages
        if (
          msg.includes('user rejected') ||
          msg.includes('user denied') ||
          msg.includes('denied transaction') ||
          msg.includes('request rejected') ||
          msg.includes('rejected the request')
        ) {
          const shortMsg = 'Transaction cancelled by user.';
          toast.error(shortMsg, { id: 'status-toast' });
          setError(shortMsg);
        } else if (msg.includes('insufficient funds') || msg.includes('exceeds the balance')) {
          toast.error('Insufficient funds.', { id: 'status-toast' });
          setError('Insufficient funds.');
        } else {
          const concise = simplifyErrorMessage(raw);
          toast.error(concise, { id: 'status-toast' });
          setError(concise);
        }
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isConnected, walletClient, publicClient, setIsLoading, setError, setContractAddress, setSuccess, setStep, selectedPurchaseAmount, isPurchaseEnabled, ownersAddresses, aiSuggestion]);

  // Connect wallet
  const connectWallet = async () => {
    try {
      setError("");
      
      // Check if wallet is available in current environment
      if (!isWalletAvailable()) {
        const environment = detectEnvironment();
        const message = getWalletAvailabilityMessage(environment);
        setError(message);
        toast.error(message, { id: 'status-toast' });
        setAutoCreateAfterConnect(false);
        return;
      }
      
      if (!connectors || connectors.length === 0) {
        console.error("No connectors available");
        setError("Wallet connection is not available. Please ensure you're using a supported app.");
        toast.error("Wallet connection is not available. Please ensure you're using a supported app.", { id: 'status-toast' });
        setAutoCreateAfterConnect(false);
        return;
      }

      // Prevent attempting Farcaster connect in untrusted embedded frames (dev tunnels)
      const envForConnect = detectEnvironment();
      if (envForConnect === 'farcaster' && !isTrustedFarcasterHost()) {
        const isEmbedded = typeof window !== 'undefined' && (window as any).top !== window;
        if (isEmbedded) {
          const msg = 'Wallet connect is blocked in this embedded view. Open the app in your browser or the official Farcaster app.';
          setError(msg);
          toast.error(msg, { id: 'status-toast', duration: 6000 });
          setAutoCreateAfterConnect(false);
          return;
        }
      }
      
      // If already connected, no need to trigger connect again
      if (isConnected && address) {
        console.log("Already connected with address:", address);
        return;
      }
      
      // Detect environment and use appropriate connector
      const environment = detectEnvironment();
      const preferredConnectorId = getPreferredConnectorId(environment);
      
      console.log(`Environment: ${environment}, Preferred connector: ${preferredConnectorId}`);
      
      // Find the best connector for the environment
      let targetConnector = connectors[0]; // Default fallback

      const preferredConnector = connectors.find((connector) => {
        const id = (connector.id || '').toLowerCase();
        const name = (connector.name || '').toLowerCase();
        const pref = (preferredConnectorId || '').toLowerCase();
        if (pref === 'injected') {
          return id.includes('injected') || name.includes('injected') || name.includes('metamask');
        }
        // Fuzzy match for Farcaster/frame connectors
        return (
          id === pref ||
          id.includes(pref) ||
          pref.includes(id) ||
          name.includes(pref) ||
          id.includes('farcaster') || name.includes('farcaster') ||
          id.includes('frame') || name.includes('frame')
        );
      });

      if (preferredConnector) {
        targetConnector = preferredConnector;
        console.log(`Using ${preferredConnector.name} connector for ${environment}`);
      } else {
        console.log(`Preferred connector ${preferredConnectorId} not found, using default`);
      }

      // In Farcaster env but untrusted host (e.g., tunnel), force injected fallback
      if (environment === 'farcaster' && !isTrustedFarcasterHost()) {
        const injectedFallback = connectors.find((c) =>
          (c.id?.toLowerCase?.() || '').includes('injected') ||
          (c.name?.toLowerCase?.() || '').includes('metamask')
        );
        if (injectedFallback) {
          targetConnector = injectedFallback;
          console.log('Untrusted Farcaster host detected; falling back to injected connector');
        }
      }

      // If Farcaster env but runtime is missing (hasSDK/hasFarcasterWindow false), prefer injected
      if (environment === 'farcaster' && !hasFarcasterRuntime()) {
        const injectedFallback = connectors.find((c) =>
          (c.id?.toLowerCase?.() || '').includes('injected') ||
          (c.name?.toLowerCase?.() || '').includes('metamask')
        );
        if (injectedFallback) {
          targetConnector = injectedFallback;
          console.log('Farcaster runtime not detected; falling back to injected connector');
        }
      }

      // Try connecting; on origin mismatch, fallback to injected if available
      try {
        await connect({ connector: targetConnector });
      } catch (err) {
        const msg = (err instanceof Error ? err.message : String(err || ''))?.toLowerCase?.() || '';
        const isOriginMismatch = msg.includes('origin') || msg.includes("origins don't match");
        if (isOriginMismatch) {
          const injectedFallback = connectors.find((c) =>
            (c.id?.toLowerCase?.() || '').includes('injected') ||
            (c.name?.toLowerCase?.() || '').includes('metamask')
          );
          if (injectedFallback) {
            console.warn('Connector origin mismatch; retrying with injected connector');
            await connect({ connector: injectedFallback });
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
      
    } catch (error) {
      console.error("Error connecting wallet:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const environment = detectEnvironment();
      
      // Enhanced error messages based on environment and error type
      let userMessage = "";
      
      if (errorMessage.includes("rejected") || errorMessage.includes("denied")) {
        userMessage = "Wallet connection was rejected. Please try again and approve the connection.";
      } else if (errorMessage.includes("not found") || errorMessage.includes("No connector")) {
        switch (environment) {
          case 'baseapp':
            userMessage = "BaseApp wallet not available. Please ensure you're using the latest version of BaseApp.";
            break;
          case 'farcaster':
            userMessage = "Farcaster wallet not available. Please ensure you're using Farcaster app or try a browser wallet.";
            break;
          case 'browser':
            userMessage = "No wallet found. Please install MetaMask or another Ethereum wallet.";
            break;
          default:
            userMessage = "Wallet not available in this environment. Please use BaseApp, Farcaster, or a browser with wallet extension.";
        }
      } else if (errorMessage.includes("network") || errorMessage.includes("RPC")) {
        userMessage = "Network connection error. Please check your internet connection and try again.";
      } else if (errorMessage.includes("switch") || errorMessage.includes("chain")) {
        userMessage = "Please switch to Base network in your wallet and try again.";
      } else {
        userMessage = `Connection failed: ${errorMessage}. Please try again or use a different wallet.`;
      }
      
      setError(userMessage);
      toast.error("Wallet connection failed", {
        id: 'status-toast',
        duration: 5000
      });
      setAutoCreateAfterConnect(false);
    }
  };

  // Connect and schedule automatic create on success
  const connectThenCreate = async () => {
    setAutoCreateAfterConnect(true);
    toast.loading('Connecting wallet...', { id: 'status-toast' });
    await connectWallet();
  };

  // When connection becomes ready and auto-create is requested, proceed
  useEffect(() => {
    if (autoCreateAfterConnect && isWalletReady) {
      setAutoCreateAfterConnect(false);
      // Proceed to create after a small tick to allow UI to update
      setTimeout(() => {
        handleCreateCoin();
      }, 100);
    }
  }, [autoCreateAfterConnect, isWalletReady]);

  // Calculate USD value
  const formattedUsdValue = (parseFloat(selectedPurchaseAmount) * ethToUsdRate).toFixed(2);

  // Open Basescan link
  const openBasescan = () => {
    window.open(`https://basescan.org/address/${contractAddress}`, '_blank');
  };

  // Reset form for creating another token
  const resetForm = () => {
    // Choose a random category again on reset so user isn't forced to pick
    let randomCategoryName = "";
    if (categories && categories.length > 0) {
      const random = categories[Math.floor(Math.random() * categories.length)];
      randomCategoryName = random?.name || "";
    }

    setFormData({
      category: randomCategoryName,
      description: "",
      name: "",
      symbol: "",
      imageUrl: ""
    });
    setStep(0);
    setSuccess("");
    setContractAddress("");
    setDisplayImageUrl("");
    setAiSuggestion(null);
    setSelectedPurchasePercentage(5);
    setSelectedPurchaseAmount("0.005");
    setIsCustomAmount(false);
    setIsPurchaseEnabled(false);
    setOwnersAddresses([]);
    setSelectedCurrency(DeployCurrency.ZORA); // Reset to SDK default on Base
    setPlatformReferrer(""); // Reset platform referrer
    // Mark random category as initialized to avoid override in effect
    randomCategoryInitialized.current = !!randomCategoryName;
  };

  // Initialize SDK and set up application
  useEffect(() => {
    // Load categories and pick a random default category once
    const cats = getCoinCategories();
    setCategories(cats);
    if (!randomCategoryInitialized.current && cats && cats.length > 0) {
      const random = cats[Math.floor(Math.random() * cats.length)];
      if (random?.name) {
        setFormData(prev => ({ ...prev, category: random.name }));
        randomCategoryInitialized.current = true;
      }
    }
    
    // Set content ready flag when initial data is loaded
    setIsContentReady(true);
    
    // Set default currency based on chain when wallet connects
    if (isConnected && walletClient) {
      walletClient.getChainId().then(chainId => {
        // Default to ETH on other chains  
        const defaultCurrency = chainId === base.id ? DeployCurrency.ZORA : DeployCurrency.ETH;
        setSelectedCurrency(defaultCurrency);
      }).catch(error => {
        console.error("Error getting chain ID:", error);
      });
    }
    
    // Define async function to initialize SDK
    const initFarcasterSDK = async () => {
      try {
        // Make sure we're on browser and not already initialized
        if (typeof window === 'undefined' || sdkInitialized.current) {
          return;
        }

        console.log("Initializing Farcaster SDK...");
        
        // Farcaster SDK yÃ¼kleme yaklaÅŸÄ±mlarÄ± - hata tolerant
        try {
          // YAKLAÅIM 1: doÄŸrudan dist altÄ±ndaki modÃ¼lÃ¼ import et
          const sdkModule = await import('@farcaster/frame-sdk/dist').catch(e => null);
          
          if (sdkModule && sdkModule.sdk) {
            farcasterSDK.current = sdkModule.sdk as FarcasterSDK;
            console.log("âœ… Farcaster SDK loaded from dist directory");
          }
          // YaklaÅŸÄ±m 1 baÅŸarÄ±sÄ±z olduysa 2. yaklaÅŸÄ±mÄ± dene
          else {
            // YAKLAÅIM 2: normal modÃ¼l import
            const fallbackModule = await import('@farcaster/frame-sdk').catch(e => null);
            
            if (fallbackModule && fallbackModule.sdk) {
              farcasterSDK.current = fallbackModule.sdk as FarcasterSDK;
              console.log("âœ… Farcaster SDK loaded from default import");
            } else {
              console.warn("âš ï¸ Could not load Farcaster SDK - continuing without it");
              return; // SDK olmadan devam et
            }
          }
          
          // SDK Prep
          if (farcasterSDK.current?.actions?.ready) {
            console.log("Calling SDK ready...");
            await farcasterSDK.current.actions.ready();
            console.log("âœ… Farcaster SDK ready");

            // After SDK ready in Farcaster/BaseApp, try silent connect again
            try {
              const envNow = detectEnvironment();
              if ((envNow === 'farcaster' || envNow === 'baseapp') && !isConnected && connectors && connectors.length > 0) {
                const farcasterLike = connectors.find((c) =>
                  (c.id?.toLowerCase?.() || '').includes('farcaster') ||
                  (c.id?.toLowerCase?.() || '').includes('frame') ||
                  (c.name?.toLowerCase?.() || '').includes('farcaster') ||
                  (c.name?.toLowerCase?.() || '').includes('frame')
                );
                if (farcasterLike) {
                  try {
                    connect({ connector: farcasterLike });
                  } catch {
                    // swallow errors
                  }
                }
              }
            } catch (_) {
              // best-effort only
            }
          }
          
          // Set initialized flag
          sdkInitialized.current = true;
          
        } catch (importError) {
          console.warn("SDK import failed - continuing without SDK:", importError);
          return; // SDK olmadan devam et
        }
        
      } catch (err) {
        console.error("âŒ SDK initialization error:", err);
        // Hata durumunda bile UI'da kÄ±rÄ±lma olmasÄ±n
      }
    };
    
    // Run initialization when content is ready
    if (isContentReady) {
      initFarcasterSDK();
    }
  }, [isContentReady, isConnected, walletClient]);
  
  // Steps for progress indicator
  const steps = [
    "DEFINE",
    "CUSTOMIZE",
    "VISUALIZE",
    "CREATE"
  ];

  // Form value update handlers
  const updateCategory = (category: string) => {
    setFormData({ ...formData, category });
  };

  const updateDescription = (description: string) => {
    setFormData({ ...formData, description });
  };

  const updateName = (name: string) => {
    setFormData({ ...formData, name });
  };

  const updateSymbol = (symbol: string) => {
    setFormData({ ...formData, symbol });
  };

  // Currency change handler
  const handleCurrencyChange = (currency: number) => {
    setSelectedCurrency(currency);
    console.log(`Currency changed to: ${currency === DeployCurrency.ZORA ? 'ZORA' : 'ETH'}`);
  };

  return (
    <div className="w-full">
      {error && <RetroNotification message={error} type="error" className="mb-4" />}
      {success && <RetroNotification message={success} type="success" className="mb-4" />}
      
      <div className="">
        <RetroSteps steps={steps} currentStep={step > 0 ? step - 1 : 0} />
      </div>
      
      {step === 0 && (
        <RetroIntro 
          onGetStarted={() => setStep(1)}
          isWalletConnected={isConnected || appEnv === 'farcaster' || appEnv === 'baseapp'}
          onConnectWallet={connectWallet}
        />
      )}
      
      {step === 1 && (
        <RetroCategories
          category={formData.category}
          description={formData.description}
          categories={categories}
          onCategoryChange={updateCategory}
          onDescriptionChange={updateDescription}
          onNext={generateAiSuggestions}
          isLoading={isLoading}
        />
      )}
      
      {step === 2 && (
        <RetroTokenDetails
          name={formData.name}
          symbol={formData.symbol}
          description={formData.description}
          aiSuggestion={aiSuggestion}
          onNameChange={updateName}
          onSymbolChange={updateSymbol}
          onDescriptionChange={updateDescription}
          onNext={generateTokenImage}
          onBack={() => setStep(1)}
          isLoading={creatingImage}
        />
      )}
      
      {step === 3 && (
        <RetroMint
          name={formData.name}
          symbol={formData.symbol}
          description={formData.description}
          imageUrl={formData.imageUrl}
          displayImageUrl={displayImageUrl}
          isPurchaseEnabled={isPurchaseEnabled}
          selectedPurchaseAmount={selectedPurchaseAmount}
          selectedPurchasePercentage={selectedPurchasePercentage}
          usdValue={formattedUsdValue}
          isCustomAmount={isCustomAmount}
          ownersAddresses={ownersAddresses}
          newOwnerAddress={newOwnerAddress}
          isConnected={uiIsConnected}
          isLoading={isLoading}
          isWalletReady={isWalletReady}
          selectedCurrency={selectedCurrency}
          onPurchaseToggle={() => setIsPurchaseEnabled(!isPurchaseEnabled)}
          onPercentageChange={setPredefinedAmount}
          onCustomAmountChange={handleCustomAmountChange}
          onNewOwnerAddressChange={setNewOwnerAddress}
          onAddOwner={addOwnerAddress}
          onRemoveOwner={removeOwnerAddress}
          onConnect={connectThenCreate}
          onCreateCoin={handleCreateCoin}
          onBack={() => setStep(2)}
          onCurrencyChange={handleCurrencyChange}
        />
      )}
      
      {step === 4 && (
        <RetroSuccess
          contractAddress={contractAddress}
          tokenName={formData.name}
          tokenSymbol={formData.symbol}
          description={formData.description}
          displayImageUrl={displayImageUrl}
          onViewOnBasescan={openBasescan}
          onCreateAnother={resetForm}
        />
      )}
    </div>
  );
} 


