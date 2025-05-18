import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useConnect, useWalletClient, usePublicClient } from "wagmi";
import { toast } from "react-hot-toast";
import { parseEther } from "viem";
import { base } from "viem/chains";

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
import { processTtlgenHerImage } from "../services/imageUtils";
import { createZoraCoin } from "../services/sdk/getCreateCoin.js";

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
  address: string;
  receipt?: {
    blockHash?: string;
    blockNumber?: bigint;
    contractAddress?: string;
    status?: string;
    transactionHash?: string;
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
  const [isPurchaseEnabled, setIsPurchaseEnabled] = useState<boolean>(true);
  const [ownersAddresses, setOwnersAddresses] = useState<string[]>([]);
  const [newOwnerAddress, setNewOwnerAddress] = useState<string>("");
  
  // AI generations
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [creatingImage, setCreatingImage] = useState(false);
  
  // Display states
  const [displayImageUrl, setDisplayImageUrl] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  
  // Wallet connection
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // Get ETH price in USD
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
    console.log("➡️ generateAiSuggestions called with:", {
      category: formData.category,
      description: formData.description
    });
    
    if (!formData.category || !formData.description) {
      console.warn("❌ Missing category or description");
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
      console.log("🔄 Sending request to:", apiUrl);
      
      // Timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.warn("⏱️ Request timeout triggered");
      }, 25000); // Increased timeout
      
      try {
        console.log("📤 Request payload:", {
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
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log("📥 Response status:", response.status);
        
        if (!response.ok) {
          // Detailed error messages
          const statusCode = response.status;
          let errorMessage = `API error: ${statusCode}`;
          
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            console.error("❌ AI API error:", errorData);
          } catch (_) {
            // JSON parsing failed, use text
            const errorText = await response.text();
            console.error("❌ AI API error text:", errorText);
          }
          
          throw new Error(errorMessage);
        }
        
        // Try to parse the response
        let data;
        try {
          data = await response.json();
          console.log("✅ AI response data:", data);
        } catch (parseError) {
          console.error("❌ Failed to parse JSON response:", parseError);
          throw new Error("Invalid response format from AI service");
        }
        
        if (!data || !data.name || !data.symbol || !data.description) {
          console.error("❌ Invalid AI response - missing fields:", data);
          throw new Error("Invalid response from AI service - missing required fields");
        }
        
        // Success - update state
        console.log("✅ Setting AI suggestion:", data);
        setAiSuggestion(data);
        
        // Populate form with AI suggestions
        console.log("✅ Updating form data with AI suggestions");
        setFormData({
          ...formData,
          name: data.name || formData.name,
          symbol: data.symbol || formData.symbol,
          description: data.description || formData.description // AI tarafından oluşturulan description'ı formData'ya kaydet
        });
        
        // Success toast
        toast.success("Analysis complete! Token details generated", { id: 'status-toast' });
        
        // Move to next step
        console.log("✅ Moving to next step");
        setStep(2);
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        
        console.error("❌ Fetch error:", fetchError);
        
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
      console.error("❌ Error generating AI suggestions:", error);
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
        console.log("✅ Setting AI suggestion from event:", data);
        setAiSuggestion(data);
        
        // Update form data with AI suggestions
        console.log("✅ Updating form data with AI suggestions from event");
        setFormData(prev => ({
          ...prev,
          name: data.name || prev.name,
          symbol: data.symbol || prev.symbol
        }));
        
        // Move to the next step
        console.log("✅ Moving to next step from event handler");
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
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        // Set loading state
        setIsLoading(true);
        setError("");
        
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
          // Increased timeout for image generation
          signal: AbortSignal.timeout(30000) // 30 second timeout
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
          const processedImage = await processTtlgenHerImage(
            data.imageUrl,
            formData.name,
            formData.symbol,
            aiSuggestion?.description || formData.description  // AI açıklamasını öncelikle kullan
          );
        
          // Update form data with IPFS URI
        setFormData(prev => ({
          ...prev,
            imageUrl: processedImage.ipfsUri
        }));
        
        // Set display URL for UI
          setDisplayImageUrl(data.imageUrl);
          
          toast.success("Image metadata uploaded to IPFS successfully!", { 
          id: 'status-toast'
        });
          
          console.log("IPFS process completed successfully");
        
        // Move to next step automatically
        setStep(3);
          
          // Break out of retry loop
          break;
        } catch (ipfsError) {
          console.error("Failed to process image through IPFS:", ipfsError);
          throw new Error(`Failed to upload to IPFS: ${ipfsError instanceof Error ? ipfsError.message : "Unknown error"}`);
        }
      } catch (error) {
        console.error(`Image generation attempt ${attempts} failed:`, error);
        
        // Show error in toast
        toast.error(
          `Image generation ${attempts < maxAttempts ? "attempt" : "failed"}: ${error instanceof Error ? error.message : "Unknown error"}`, 
          { id: 'status-toast' }
        );
        
        // Set error state
        if (attempts >= maxAttempts) {
          setError(`Failed to generate image after ${maxAttempts} attempts: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
        
        // Wait before retry
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } finally {
        setIsLoading(false);
        setCreatingImage(false);
      }
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
      setError("Wallet client is not available. Please reconnect your wallet.");
      setIsLoading(false);
      return;
    }

    try {
      // Check if we're on the Base network
      const chainId = await walletClient.getChainId();
      if (chainId !== base.id) {
        setError(`You're connected to network ID ${chainId}, but Base network (${base.id}) is required. Please switch networks.`);
        toast.error("Please switch to Base network", { id: 'status-toast', duration: 5000 });
        setIsLoading(false);
        return;
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
        
        // Minimum amount needed for the transaction (purchase amount + gas buffer)
        const gasBuffer = parseEther("0.002"); // ~0.002 ETH for gas
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
      
      // Create Zora coin using SDK with the IPFS URI
      console.log("Creating coin with URI:", formData.imageUrl);
      
        const result = await createZoraCoin({
          name: formData.name,
          symbol: formData.symbol,
          uri: formData.imageUrl,
          payoutRecipient: walletAddress,
          initialPurchaseWei: isPurchaseEnabled ? parseEther(selectedPurchaseAmount) : BigInt(0),
          owners: ownersAddresses.length > 0 ? ownersAddresses : undefined
        }, walletClient, publicClient, { gasMultiplier: 120 }) as CoinCreationResult;
        
        console.log("Token created successfully:", result);
        
        // Update toast with success
        toast.success("Coin created successfully!", {
          id: 'status-toast'
        });
        
        // Set the contract address from the actual transaction - ensure property exists
        if (result && typeof result === 'object' && 'address' in result) {
          setContractAddress(result.address);
        } else {
          console.warn("Contract address not found in result:", result);
          // Fallback if address is missing but transaction was successful
          setContractAddress("Contract created, address unknown");
        }
        
        // Set success message
        setSuccess(`Coin ${formData.name} (${formData.symbol}) created successfully on Base network!`);
        
        // Move to the next step
        setStep(4);
      } catch (error) {
        console.error("Error creating coin:", error);
        
      // Handle different error types
        if (error instanceof Error && 
          (error.message.includes("insufficient funds") || 
           error.message.includes("exceeds the balance"))) {
          // Handle insufficient funds error
          console.error("Insufficient funds for transaction:", error);
          toast.error("Not enough ETH in your wallet for this transaction", {
            id: 'status-toast'
          });
          setError(`Failed to create coin: Insufficient funds. Please make sure you have enough ETH (at least ${selectedPurchaseAmount} ETH plus gas).`);
        } else {
          // For other errors, show a general error message
        toast.error(`Failed to create coin: ${error instanceof Error ? error.message : "Unknown error"}`, {
            id: 'status-toast'
          });
          setError(`Failed to create coin: ${error instanceof Error ? error.message : "Unknown error"}`);
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
      
      if (!connectors || connectors.length === 0) {
        console.error("No connectors available - Farcaster connector not properly initialized");
        setError("Wallet connection is not available. Please ensure you're using Warpcast app.");
        return;
      }
      
      // Check current connection first
      if (isConnected && address) {
        console.log("Already connected with address:", address);
        toast.success(`Already connected: ${address.substring(0, 6)}...${address.substring(38)}`, {
          id: 'status-toast'
        });
        return;
      }
      
      console.log("Connecting with Farcaster connector...");
      
      // Simple connection using official documentation
      await connect({ connector: connectors[0] });
      
      // The connection process is asynchronous, so we can't check the result directly here.
      // The useAccount hook will automatically update isConnected and address values.
      toast.success("Wallet connection initiated.", {
        id: 'status-toast'
      });
      
    } catch (error) {
      console.error("Error connecting wallet:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to connect wallet: ${errorMessage}. Please try again.`);
    }
  };

  // Calculate USD value
  const formattedUsdValue = (parseFloat(selectedPurchaseAmount) * ethToUsdRate).toFixed(2);

  // Open Basescan link
  const openBasescan = () => {
    window.open(`https://basescan.org/address/${contractAddress}`, '_blank');
  };

  // Reset form for creating another token
  const resetForm = () => {
    setFormData({
      category: "",
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
    setSelectedPurchasePercentage(10);
    setSelectedPurchaseAmount("0.01");
    setIsCustomAmount(false);
    setIsPurchaseEnabled(true);
    setOwnersAddresses([]);
  };

  // Initialize SDK and set up application
  useEffect(() => {
    // Load categories
    setCategories(getCoinCategories());
    
    // Set content ready flag when initial data is loaded
    setIsContentReady(true);
    
    // Define async function to initialize SDK
    const initFarcasterSDK = async () => {
      try {
        // Make sure we're on browser and not already initialized
        if (typeof window === 'undefined' || sdkInitialized.current) {
          return;
        }

        console.log("Initializing Farcaster SDK...");
        
        // Farcaster SDK yükleme yaklaşımları - hata tolerant
        try {
          // YAKLAŞIM 1: doğrudan dist altındaki modülü import et
          const sdkModule = await import('@farcaster/frame-sdk/dist').catch(e => null);
          
          if (sdkModule && sdkModule.sdk) {
            farcasterSDK.current = sdkModule.sdk as FarcasterSDK;
            console.log("✅ Farcaster SDK loaded from dist directory");
          }
          // Yaklaşım 1 başarısız olduysa 2. yaklaşımı dene
          else {
            // YAKLAŞIM 2: normal modül import
            const fallbackModule = await import('@farcaster/frame-sdk').catch(e => null);
            
            if (fallbackModule && fallbackModule.sdk) {
              farcasterSDK.current = fallbackModule.sdk as FarcasterSDK;
              console.log("✅ Farcaster SDK loaded from default import");
            } else {
              console.warn("⚠️ Could not load Farcaster SDK - continuing without it");
              return; // SDK olmadan devam et
            }
          }
          
          // SDK Prep
          if (farcasterSDK.current?.actions?.ready) {
            console.log("Calling SDK ready...");
            await farcasterSDK.current.actions.ready();
            console.log("✅ Farcaster SDK ready");
          }
          
          // Set initialized flag
          sdkInitialized.current = true;
          
        } catch (importError) {
          console.warn("SDK import failed - continuing without SDK:", importError);
          return; // SDK olmadan devam et
        }
        
      } catch (err) {
        console.error("❌ SDK initialization error:", err);
        // Hata durumunda bile UI'da kırılma olmasın
      }
    };
    
    // Run initialization when content is ready
    if (isContentReady) {
      initFarcasterSDK();
    }
  }, [isContentReady]);
  
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

  return (
    <div className="w-full">
      {error && <RetroNotification message={error} type="error" className="mb-4" />}
      {success && <RetroNotification message={success} type="success" className="mb-4" />}
      
      <div className="mb-6">
        <RetroSteps steps={steps} currentStep={step > 0 ? step - 1 : 0} />
      </div>
      
      {step === 0 && (
        <RetroIntro onGetStarted={() => setStep(1)} />
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
          aiSuggestion={aiSuggestion}
          onNameChange={updateName}
          onSymbolChange={updateSymbol}
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
          isConnected={isConnected}
          isLoading={isLoading}
          onPurchaseToggle={() => setIsPurchaseEnabled(!isPurchaseEnabled)}
          onPercentageChange={setPredefinedAmount}
          onCustomAmountChange={handleCustomAmountChange}
          onNewOwnerAddressChange={setNewOwnerAddress}
          onAddOwner={addOwnerAddress}
          onRemoveOwner={removeOwnerAddress}
          onConnect={connectWallet}
          onCreateCoin={handleCreateCoin}
          onBack={() => setStep(2)}
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