"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useConnect, useWalletClient, usePublicClient } from "wagmi";
// Kullanılmayan importları kaldırdık
import { Button } from "./ui/Button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { getCoinCategories } from "../services/aiService.js";
import { toast } from "react-hot-toast";
import { generateImageWithAI } from "../services/aiService";
import { processTtlgenHerImage, validateIpfsUri } from "../services/imageUtils";
import { getIPFSDisplayUrl } from "../services/imageUtils";
import { getCoinCreationParams, createZoraCoin } from "../services/sdk/getCreateCoin.js";
import { parseEther } from "viem";
import { base } from "viem/chains";

// Define interface for the validation result
interface IpfsValidationResult {
  valid: boolean;
  message: string;
  uri: string;
}

// Spesifik tip tanımları
interface FormData {
  category: string;
  description: string;
  name: string;
  symbol: string;
  imageUrl: string;
}

// CategoryItem tipini getCoinCategories fonksiyonunun döndürdüğü gerçek tipi yansıtacak şekilde tanımla
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
    setPrimaryButton: (options: { text: string }) => Promise<void>;
  };
  events?: {
    on: (event: string, callback: () => void) => void;
  };
  wallet?: {
    ethProvider: {
      request: (args: { method: string }) => Promise<string[]>
    }
  };
}

export default function CoinCreator() {
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
  
  // Wallet connection
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  
  // Wallet client hooks - moved to component top level
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  // Contract address
  const [contractAddress, setContractAddress] = useState<string>("");
  
  // Token image gösterimi için display URL state'i
  const [displayImageUrl, setDisplayImageUrl] = useState<string>("");
  
  // Interface for the result from createZoraCoin
  interface CoinCreationResult {
    hash: string;
    address: string;
    receipt?: any;
  }

  // Generate AI suggestions for token name and description
  const generateAiSuggestions = useCallback(async () => {
    if (!formData.category || !formData.description) {
      setError("Please select a category and provide a description");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    try {
      // Use full URL to avoid relative URL issues
      const apiUrl = `${window.location.origin}/api/ai`;
      console.log("Sending request to:", apiUrl);
      
      // Timeout kontrolü ekle
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 saniye timeout
      
      try {
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
        
        if (!response.ok) {
          // Detaylı hata mesajları
          const statusCode = response.status;
          let errorMessage = `API error: ${statusCode}`;
          
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            console.error("AI API error:", errorData);
          } catch (e) {
            // JSON parsing failed, use text
            const errorText = await response.text();
            console.error("AI API error text:", errorText);
          }
          
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (!data || !data.name || !data.symbol || !data.description) {
          throw new Error("Invalid response from AI service - missing required fields");
        }
        
        setAiSuggestion(data);
        
        // Populate form with AI suggestions
        setFormData({
          ...formData,
          name: data.name || formData.name,
          symbol: data.symbol || formData.symbol
        });
        
        // Move to next step
        setStep(2);
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        
        if (fetchError && typeof fetchError === 'object' && 'name' in fetchError && fetchError.name === 'AbortError') {
          throw new Error("Request to AI service timed out. Please try again.");
        }
        
        throw fetchError;
      }
    } catch (error) {
      console.error("Error generating AI suggestions:", error);
      setError(`Failed to generate AI suggestions: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  }, [formData, setFormData, setAiSuggestion, setError, setIsLoading, setStep]);

  // Generate token image with AI
  const generateTokenImage = useCallback(async () => {
    if (isLoading) return;
    
    // Reset image state
    setCreatingImage(true);
    setDisplayImageUrl("");
    setError("");
    
    // Validate required fields
    if (!formData.name || !formData.symbol || !formData.description) {
      setError("Name, symbol, and description are required to generate an image");
      setCreatingImage(false);
      return;
    }
    
    console.log("Starting image generation for token:", formData.name);
    
    // Track retries
    let attempts = 0;
    const maxAttempts = 3;
    let success = false;
    
    while (attempts < maxAttempts && !success) {
      attempts++;
      
      try {
        // Set loading state
        setIsLoading(true);
        setError("");
        
        // Display attempt information if retrying
        if (attempts > 1) {
          toast.loading(`Retrying image generation (attempt ${attempts}/${maxAttempts})...`, {
            id: "image-retry"
          });
        } else {
          toast.loading("Generating token image...", {
            id: "image-generation"
          });
        }
        
        // Call the image generation API
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "image",
            name: formData.name,
            symbol: formData.symbol,
            description: formData.description,
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
        
        // Process the image through our service to ensure it's in IPFS format
        console.log("Processing AI-generated image for IPFS compatibility...");
        
        const ipfsImageUrl = await processTtlgenHerImage(data.imageUrl);
        
        // Update form data with IPFS URL
        setFormData(prev => ({
          ...prev,
          imageUrl: ipfsImageUrl
        }));
        
        // Set display URL for UI
        const displayUrl = getIPFSDisplayUrl(ipfsImageUrl);
        setDisplayImageUrl(displayUrl);
        
        console.log("Image generated successfully:", {
          ipfsImageUrl,
          displayUrl
        });
        
        // Mark as success to exit retry loop
        success = true;
        
        // Show success message
        toast.success("Image generated successfully!", {
          id: attempts > 1 ? "image-retry" : "image-generation"
        });
        
        // Move to next step automatically
        setStep(3);
      } catch (error) {
        console.error(`Image generation attempt ${attempts} failed:`, error);
        
        // Show error in toast
        toast.error(
          `Image generation ${attempts < maxAttempts ? "attempt" : "failed"}: ${error instanceof Error ? error.message : "Unknown error"}`, 
          { id: attempts > 1 ? "image-retry" : "image-generation" }
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
      }
    }
    
    // Final state update
    setCreatingImage(false);
  }, [formData, isLoading, setCreatingImage, setDisplayImageUrl, setError, setFormData, setIsLoading, setStep, toast]);

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

  // Set predefined amount
  const setPredefinedAmount = (percentage: number) => {
    setSelectedPurchasePercentage(percentage);
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

  // Handle coin creation with useCallback
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
        toast.error("Please switch to Base network", { duration: 5000 });
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
        // NEW: Check user's balance before proceeding
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
            id: "insufficient-funds",
            duration: 4000 
          });
          setIsLoading(false);
          return;
        }
      }
      
      // Show a loading toast for the creation process
      toast.loading("Creating your coin - this may take a moment...", {
        id: "coin-creation",
        duration: 10000
      });
      
      // Validate the IPFS URI before attempting to create the coin
      console.log("Validating IPFS URI:", formData.imageUrl);
      const validationResult = await validateIpfsUri(formData.imageUrl) as IpfsValidationResult;
      
      // Log validation result but don't block on warnings
      if (!validationResult.valid) {
        console.warn("IPFS URI validation failed:", validationResult.message);
        toast.error("Image URI may have issues. Using fallback if needed.", {
          id: "uri-warning",
          duration: 5000
        });
      } else if (validationResult.message !== "URI validated") {
        console.info("IPFS URI validation warning:", validationResult.message);
      }
      
      try {
        // Create Zora coin using SDK with the validated URI
        const result = await createZoraCoin({
          name: formData.name,
          symbol: formData.symbol,
          uri: validationResult.uri, // Use the potentially fixed URI
          payoutRecipient: walletAddress, // User receives payouts
          initialPurchaseWei: isPurchaseEnabled ? parseEther(selectedPurchaseAmount) : BigInt(0), // Use 0 if purchase is disabled
          owners: ownersAddresses.length > 0 ? ownersAddresses : undefined
        }, walletClient, publicClient, { gasMultiplier: 120 }) as CoinCreationResult;
        
        console.log("Token created successfully:", result);
        
        // Update toast with success
        toast.success("Coin created successfully!", {
          id: "coin-creation"
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
        
        // Check for metadata-specific errors
        if (error instanceof Error && 
            (error.message.includes("Metadata fetch failed") || 
             error.message.includes("Data URIs are not supported") ||
             error.message.includes("URI") ||
             error.message.includes("metadata") ||
             error.message.includes("decentralized-content.com") ||
             error.message.includes("magic.decentralized"))) {
          
          // Update the toast with a specific metadata error message
          toast.error("IPFS gateway is slow - using our faster alternative", {
            id: "coin-creation",
            duration: 4000
          });
          
          // Show a more specific error to the user
          setError("The IPFS gateway is not responding. We're using our high-speed proxy instead. Please wait a moment...");
          
          // Wait a moment before retrying with a fallback
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            // Try again with a more robust approach - manually specifying a working metadata format
            const result = await createZoraCoin({
              name: formData.name,
              symbol: formData.symbol,
              uri: formData.imageUrl, // Original URI will trigger our fallback mechanism
              payoutRecipient: walletAddress,
              initialPurchaseWei: isPurchaseEnabled ? parseEther(selectedPurchaseAmount) : BigInt(0), // Use 0 if purchase is disabled
              owners: ownersAddresses.length > 0 ? ownersAddresses : undefined
            }, walletClient, publicClient, { gasMultiplier: 150 }) as CoinCreationResult;
            
            console.log("Token created successfully with fallback method:", result);
            
            // Success toast
            toast.success("Coin created successfully with alternative metadata!", {
              id: "coin-creation"
            });
            
            // Set contract address
            if (result && typeof result === 'object' && 'address' in result) {
              setContractAddress(result.address);
            } else {
              setContractAddress("Contract created, address unknown");
            }
            
            // Set success message
            setSuccess(`Coin ${formData.name} (${formData.symbol}) created successfully on Base network!`);
            
            // Move to success screen
            setStep(4);
            return;
          } catch (fallbackError) {
            // Check if this is an insufficient funds error
            if (fallbackError instanceof Error && 
              (fallbackError.message.includes("insufficient funds") || 
               fallbackError.message.includes("exceeds the balance"))) {
              // Show clear feedback about funds issue
              console.error("Insufficient funds for transaction:", fallbackError);
              toast.error("Not enough ETH in your wallet for this transaction", {
                id: "coin-creation"
              });
              setError(`Failed to create coin: Insufficient funds. Please make sure you have enough ETH (at least ${selectedPurchaseAmount} ETH plus gas).`);
            } else {
              console.error("Fallback creation method also failed:", fallbackError);
              toast.error("Unable to create coin after multiple attempts", {
                id: "coin-creation"
              });
              setError(`Failed to create coin: ${fallbackError instanceof Error ? fallbackError.message : "Unknown error during fallback"}`);
            }
          }
        } else if (error instanceof Error && 
          (error.message.includes("insufficient funds") || 
           error.message.includes("exceeds the balance"))) {
          // Handle insufficient funds error
          console.error("Insufficient funds for transaction:", error);
          toast.error("Not enough ETH in your wallet for this transaction", {
            id: "coin-creation"
          });
          setError(`Failed to create coin: Insufficient funds. Please make sure you have enough ETH (at least ${selectedPurchaseAmount} ETH plus gas).`);
        } else {
          // For other errors, show a general error message
          toast.error("Failed to create coin", {
            id: "coin-creation"
          });
          setError(`Failed to create coin: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }
    } catch (error) {
      console.error("Error creating coin:", error);
      setError(`Failed to create coin: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  }, [formData, isConnected, walletClient, publicClient, setIsLoading, setError, setContractAddress, setSuccess, setStep, selectedPurchaseAmount, isPurchaseEnabled, ownersAddresses]);
  
  // Wallet connection status change observer
  useEffect(() => {
    // Cüzdan bağlantısı değişikliğini izle ve kullanıcıyı bilgilendir
    if (isConnected && address) {
      console.log("Wallet connected:", address);
      toast.success(`Connected to wallet: ${address.substring(0, 6)}...${address.substring(38)}`);
    }
  }, [isConnected, address]);
  
  // Initialize SDK and set up application
  useEffect(() => {
    // Load categories
    setCategories(getCoinCategories());
    
    // Set content ready flag when initial data is loaded
    setIsContentReady(true);
    
    // Define async function to initialize SDK
    const initFarcasterSDK = async () => {
      try {
        // Tarayıcı tarafında olduğumuzdan ve daha önce başlatılmadığından emin olalım
        if (typeof window === 'undefined' || sdkInitialized.current) {
          return;
        }

        console.log("Initializing Farcaster SDK...");
        
        // SDK'yı dinamik olarak import et
        try {
          if (typeof window !== 'undefined') {
            const sdkModule = await import('@farcaster/frame-sdk');
            
            // SDK nesnesinin varlığını kontrol et
            if (!sdkModule || !sdkModule.sdk) {
              console.error("SDK module loaded but sdk object is missing");
              return;
            }
            
            // SDK'yı kaydet
            farcasterSDK.current = sdkModule.sdk as FarcasterSDK;
            console.log("Farcaster SDK imported successfully", farcasterSDK.current);
            
            // SDK hazır mı kontrol et
            if (typeof farcasterSDK.current?.actions?.ready !== 'function') {
              console.warn("SDK ready method not available");
            }
            
            // SDK'yı hazırla
            try {
              if (farcasterSDK.current?.actions?.ready) {
                console.log("Calling SDK ready...");
                await farcasterSDK.current.actions.ready();
                console.log("✅ Farcaster SDK ready, splash screen hidden");
              }
              
              // Primary button'u ayarla
              if (farcasterSDK.current?.actions?.setPrimaryButton) {
                await farcasterSDK.current.actions.setPrimaryButton({ 
                  text: step === 0 ? "Get Started" : 
                        step === 3 ? "Create Token" : "Continue"
                });
                console.log("✅ Primary button set with text:", 
                  step === 0 ? "Get Started" : 
                  step === 3 ? "Create Token" : "Continue");
              }
              
              // Başarılı bir şekilde başlatıldı
              sdkInitialized.current = true;
              console.log("✅ Farcaster SDK initialization complete");
              
              // Eventleri dinle
              if (farcasterSDK.current && typeof farcasterSDK.current.events?.on === 'function') {
                farcasterSDK.current.events.on("primaryButtonClicked", () => {
                  console.log("Primary button clicked event received");
                  if (step === 0) {
                    setStep(1);
                  } else if (step === 1) {
                    generateAiSuggestions();
                  } else if (step === 2) {
                    generateTokenImage();
                  } else if (step === 3) {
                    handleCreateCoin();
                  }
                });
                console.log("✅ Primary button click event listener set up");
              } else {
                console.warn("SDK events API not available");
              }
              
              // Cüzdan kontrol et
              if (farcasterSDK.current && (farcasterSDK.current as any)?.wallet?.ethProvider) {
                console.log("✅ Wallet provider available");
              } else {
                console.warn("Wallet provider not available in SDK");
              }
              
            } catch (sdkError) {
              console.error("SDK initialization error:", sdkError);
            }
          }
        } catch (importError) {
          console.error("Failed to import Farcaster SDK:", importError);
          return;
        }
        
      } catch (err) {
        console.error("❌ Failed to initialize Farcaster SDK:", err);
      }
    };
    
    // Run initialization when content is ready
    if (isContentReady) {
      initFarcasterSDK();
    }
  }, [isContentReady, step, handleCreateCoin, generateAiSuggestions, generateTokenImage]);
  
  // Respond to step changes in UI
  useEffect(() => {
    if (!sdkInitialized.current || typeof window === 'undefined' || !farcasterSDK.current) return;
    
    // When step changes, try to update the primary button if available
    const updateUI = async () => {
      try {
        if (farcasterSDK.current?.actions?.setPrimaryButton) {
          if (step === 0) {
            await farcasterSDK.current.actions.setPrimaryButton({ 
              text: "Get Started"
            });
          } else if (step === 1) {
            await farcasterSDK.current.actions.setPrimaryButton({ 
              text: "Generate Suggestions"
            });
          } else if (step === 2) {
            await farcasterSDK.current.actions.setPrimaryButton({ 
              text: "Generate Image"
            });
          } else if (step === 3) { // Preview step
            await farcasterSDK.current.actions.setPrimaryButton({ 
              text: "Create Token"
            });
          } else {
            // Use a generic text for other steps
            await farcasterSDK.current.actions.setPrimaryButton({ 
              text: "Continue"
            });
          }
        }
      } catch (err) {
        // Silently fail if button API isn't available
        console.warn("Failed to update primary button:", err);
      }
    };
    
    updateUI();
  }, [step]);
  
  // Handle form changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  // Connect wallet
  const connectWallet = async () => {
    try {
      setError("");
      
      if (!connectors || connectors.length === 0) {
        console.error("No connectors available - Farcaster connector not properly initialized");
        setError("Wallet connection is not available. Please ensure you're using Warpcast app.");
        return;
      }
      
      // Öncelikle mevcut bağlantıyı kontrol et
      if (isConnected && address) {
        console.log("Already connected with address:", address);
        toast.success(`Already connected: ${address.substring(0, 6)}...${address.substring(38)}`);
        return;
      }
      
      console.log("Connecting with Farcaster connector...");
      
      // Resmi dokümantasyona göre basit bağlantı yöntemi
      await connect({ connector: connectors[0] });
      
      // Bağlantı işlemi asenkron olduğundan, sonucunu doğrudan burada kontrol edemiyoruz.
      // useAccount hook'u isConnected ve address değerlerini otomatik olarak güncelleyecek.
      toast.success("Wallet connection initiated.");
      
    } catch (error) {
      console.error("Error connecting wallet:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to connect wallet: ${errorMessage}. Please try again.`);
    }
  };
  
  // Render step 1 - Category and description selection
  const renderStep1 = () => (
    <div className="container-sm fade-in">
      <div className="card border border-gray-mid shadow-sm transition-all">
        {/* Step heading */}
        <div className="flex items-center mb-5">
          <div className="w-8 h-8 rounded-full bg-indigo-600/10 flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-indigo-600">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <h2 className="text-lg font-bold">Create Your Coin</h2>
        </div>
        
        {/* Category selection */}
        <div className="mb-5">
          <Label htmlFor="category" className="text-foreground flex items-center mb-2 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-indigo-600">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            Select Category
          </Label>
          <div className="relative">
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="input-field pr-10 appearance-none bg-white w-full"
            >
              <option value="">Choose a category</option>
              {categories.map((cat, idx) => (
                <option key={idx} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-dark">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-dark mt-1">Choose the category that best describes your token's purpose</p>
        </div>
        
        {/* Description area */}
        <div className="mb-5">
          <Label htmlFor="description" className="text-foreground flex items-center mb-2 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-indigo-600">
              <line x1="17" y1="10" x2="3" y2="10"></line>
              <line x1="21" y1="6" x2="3" y2="6"></line>
              <line x1="21" y1="14" x2="3" y2="14"></line>
              <line x1="17" y1="18" x2="3" y2="18"></line>
            </svg>
            Describe Your Token Idea
          </Label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="input-field min-h-[100px] resize-y transition-colors duration-200"
            placeholder="Describe the purpose, features, and target audience of your token..."
          />
          <p className="text-xs text-gray-dark mt-1">The more details you provide, the better AI suggestions you'll get</p>
        </div>
        
        {/* Tip card */}
        <div className="p-3 bg-violet-100/30 border border-violet-300/20 rounded-sm flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-violet-600 mt-0.5 mr-2 flex-shrink-0">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <p className="text-sm text-gray-dark">
            Our AI will generate a token name, symbol, and description based on your input. 
            You'll be able to edit these suggestions in the next step.
          </p>
        </div>
      </div>
      
      {/* Button */}
      <Button 
        onClick={generateAiSuggestions} 
        isLoading={isLoading}
        fullWidth
        size="lg"
        className="mt-5 bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800"
      >
        <span className="flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="8" y1="12" x2="16" y2="12"></line>
            <line x1="12" y1="16" x2="12" y2="8"></line>
          </svg>
          Generate AI Suggestions
        </span>
      </Button>
    </div>
  );
  
  // Render step 2 - Name and symbol confirmation
  const renderStep2 = () => (
    <div className="container-sm fade-in">
      <div className="card border border-gray-mid shadow-sm transition-all">
        {/* Step heading */}
        <div className="flex items-center mb-5">
          <div className="w-8 h-8 rounded-full bg-indigo-600/10 flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-indigo-600">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          </div>
          <h2 className="text-lg font-bold">Coin Details</h2>
        </div>
        
        {/* AI suggestion */}
        {aiSuggestion && (
          <div className="mb-5 overflow-hidden rounded-sm border border-indigo-300/20">
            <div className="bg-indigo-50/40 p-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-indigo-600 mr-2">
                <path d="M12 2a10 10 0 0 1 10 10c0 5.5-5 7-10 13-5-6-10-7.5-10-13A10 10 0 0 1 12 2z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <h3 className="text-sm font-medium text-foreground">AI Suggestion</h3>
            </div>
            <div className="p-3 bg-white">
              <p className="text-sm text-gray-dark">{aiSuggestion.description}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {aiSuggestion.category}
                </span>
                {aiSuggestion.features && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
                    Features
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Name input field */}
        <div className="mb-5">
          <Label htmlFor="name" className="text-foreground flex items-center mb-2 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-indigo-600">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Token Name
          </Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter token name"
            className="w-full bg-white text-foreground"
          />
          <p className="text-xs text-gray-dark mt-1">A memorable name that reflects your token's purpose</p>
        </div>
        
        {/* Symbol input field */}
        <div className="mb-5">
          <Label htmlFor="symbol" className="text-foreground flex items-center mb-2 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-indigo-600">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            Token Symbol
          </Label>
          <Input
            id="symbol"
            name="symbol"
            value={formData.symbol}
            onChange={handleChange}
            placeholder="3-4 characters (e.g. BTC)"
            className="uppercase w-full bg-white text-foreground"
            maxLength={4}
          />
          <p className="text-xs text-gray-dark mt-1">Usually 3-4 capital letters (like BTC or ETH)</p>
        </div>
        
        {/* Tip card */}
        <div className="p-3 bg-violet-100/30 border border-violet-300/20 rounded-sm">
          <h4 className="text-sm font-medium text-foreground mb-1 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-violet-600">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6L12 10"></path>
              <path d="M12 14L12.01 14"></path>
            </svg>
            Next step: Generate token image
          </h4>
          <p className="text-xs text-gray-dark">
            In the next step, our AI will create a unique image for your token based on these details.
          </p>
        </div>
      </div>
      
      {/* Navigation buttons */}
      <div className="flex gap-3 mt-5">
        <Button 
          onClick={() => setStep(1)} 
          variant="outline"
          fullWidth
          className="border-gray-mid"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
            <path d="M19 12H5"></path>
            <path d="M12 19l-7-7 7-7"></path>
          </svg>
          Back
        </Button>
        
        <Button 
          onClick={generateTokenImage} 
          isLoading={creatingImage}
          fullWidth
          className="bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800"
        >
          <span className="flex items-center justify-center">
            {!creatingImage && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
                <path d="M5 12h14"></path>
                <path d="M12 5l7 7-7 7"></path>
              </svg>
            )}
            {creatingImage ? "Creating Image..." : "Next"}
          </span>
        </Button>
      </div>
    </div>
  );
  
  // Render step 3 - Image and mint
  const renderStep3 = () => {
    // Calculate USD value
    const usdValue = parseFloat(selectedPurchaseAmount) * ethToUsdRate;
    const formattedUsdValue = usdValue.toFixed(2);
    
    return (
      <div className="container-sm fade-in">
        <div className="card border border-gray-mid shadow-sm transition-all">
          <div className="flex items-center mb-5">
            <div className="w-8 h-8 rounded-full bg-indigo-600/10 flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-indigo-600">
                <path d="M12 22s8-4 8-10V4l-8-2-8 2v8c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold">Create Your Token</h2>
          </div>
          
          <div className="mb-5">
            <h3 className="text-sm font-medium mb-3">Token Preview</h3>
            <div className="rounded-sm overflow-hidden border border-gray-mid p-4">
              {formData.imageUrl && (
                <div className="mb-4 flex justify-center">
                  <div className="relative w-32 h-32 rounded-sm overflow-hidden">
                    <img 
                      src={displayImageUrl || getIPFSDisplayUrl(formData.imageUrl)} 
                      alt="Token" 
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        console.error("Image load error");
                        (e.target as HTMLImageElement).src = "/placeholder.png";
                      }}
                    />
                    {creatingImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm"><span className="font-medium">Name:</span> {formData.name}</p>
                <p className="text-sm"><span className="font-medium">Symbol:</span> {formData.symbol}</p>
                <p className="text-sm"><span className="font-medium">Description:</span> {formData.description}</p>
              </div>
            </div>
          </div>
          
          {/* Purchase amount slider with buttons and toggle */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="purchasePercentage" className="text-foreground flex items-center text-sm font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-indigo-600">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                Initial Purchase
              </Label>
              
              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isPurchaseEnabled}
                    onChange={() => setIsPurchaseEnabled(!isPurchaseEnabled)}
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  <span className="ml-2 text-sm font-medium text-gray-700">
                    {isPurchaseEnabled ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>
            </div>
            
            {isPurchaseEnabled && (
              <>
                <div className="mb-2 flex justify-between items-center">
                  <span className="text-sm font-medium text-indigo-700">{selectedPurchaseAmount} ETH</span>
                  <span className="text-xs text-gray-500">${formattedUsdValue} USD</span>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="range"
                    id="purchasePercentage"
                    min="1"
                    max="50"
                    value={isCustomAmount ? 1 : selectedPurchasePercentage}
                    onChange={(e) => {
                      setIsCustomAmount(false);
                      setSelectedPurchasePercentage(parseInt(e.target.value));
                    }}
                    className="w-full h-2 bg-gray-200 rounded-sm appearance-none cursor-pointer accent-indigo-600"
                    disabled={isCustomAmount}
                  />
                </div>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => setPredefinedAmount(5)}
                    className={`px-2 py-1 text-xs rounded-md ${selectedPurchasePercentage === 5 && !isCustomAmount ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    5%
                  </button>
                  <button
                    onClick={() => setPredefinedAmount(10)}
                    className={`px-2 py-1 text-xs rounded-md ${selectedPurchasePercentage === 10 && !isCustomAmount ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    10%
                  </button>
                  <button
                    onClick={() => setPredefinedAmount(25)}
                    className={`px-2 py-1 text-xs rounded-md ${selectedPurchasePercentage === 25 && !isCustomAmount ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    25%
                  </button>
                  <button
                    onClick={() => setPredefinedAmount(50)}
                    className={`px-2 py-1 text-xs rounded-md ${selectedPurchasePercentage === 50 && !isCustomAmount ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    50%
                  </button>
                  <div className="flex-1 min-w-[150px]">
                    <div className="flex items-center border rounded-md overflow-hidden">
                      <input
                        type="number"
                        placeholder="Custom ETH"
                        value={isCustomAmount ? selectedPurchaseAmount : ""}
                        onChange={handleCustomAmountChange}
                        className="w-full px-2 py-1 text-xs border-none focus:outline-none focus:ring-0"
                        step="0.001"
                        min="0.001"
                      />
                      <span className="px-2 text-xs bg-gray-100">ETH</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-gray-dark mb-2">
                  {isCustomAmount 
                    ? "Using custom amount" 
                    : `${selectedPurchasePercentage}% of your available balance`}
                </p>
              </>
            )}
          </div>
          
          {/* Owners/Contributors section */}
          <div className="mb-5">
            <h3 className="text-sm font-medium mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-indigo-600">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Co-owners (Optional)
            </h3>
            
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="Owner address (0x...)"
                value={newOwnerAddress}
                onChange={(e) => setNewOwnerAddress(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={addOwnerAddress}
                disabled={!newOwnerAddress}
                className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            
            {ownersAddresses.length > 0 && (
              <div className="mb-3 space-y-2">
                {ownersAddresses.map((address, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                    <span className="text-xs text-gray-700 truncate max-w-[200px]">{address}</span>
                    <button
                      onClick={() => removeOwnerAddress(address)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <p className="text-xs text-gray-dark">
              Add additional owner addresses if you want to share control of this token
            </p>
          </div>
          
          {!isConnected && (
            <div className="mb-5 p-3 bg-violet-100/30 border border-violet-300/20 rounded-sm">
              <p className="text-sm mb-2 font-medium">Wallet connection required to create your token</p>
              <p className="text-xs text-gray-dark mb-3">You must connect a real wallet to create your token. No mock addresses will be used.</p>
              <Button 
                onClick={connectWallet} 
                variant="outline"
                size="sm"
                className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
                  <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
                Connect Wallet
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex gap-3 mt-5">
          <Button 
            onClick={() => setStep(2)} 
            variant="outline"
            fullWidth
            className="border-gray-mid"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
            Back
          </Button>
          
          <Button 
            onClick={handleCreateCoin}
            isLoading={isLoading}
            fullWidth
            disabled={isLoading || !formData.name || !formData.symbol || !formData.imageUrl || !isConnected}
            className="bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800"
          >
            <span className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
              {!isConnected ? "Connect Wallet to Create" : "Create Token"}
            </span>
          </Button>
        </div>
      </div>
    );
  };
  
  // Render Step 4: Success Page
  const renderStep4 = () => {
    return (
      <div className="container-sm fade-in">
        <div className="card border border-gray-mid shadow-sm transition-all">
          <div className="flex items-center mb-5">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-green-500">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h2 className="text-lg font-bold">Congratulations!</h2>
          </div>
          
          <div className="p-3 mb-5 rounded-sm bg-green-50/70 border border-green-200/30">
            <p className="text-sm">{success}</p>
          </div>
          
          <div className="mb-5">
            <h3 className="text-sm font-medium mb-3">Contract Details</h3>
            <div className="p-3 rounded-sm bg-gray-50 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Contract Address:</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(contractAddress);
                    toast.success("Address copied to clipboard!");
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
              </div>
              <code className="block mt-2 text-xs p-2 rounded bg-white overflow-x-auto border border-gray-mid">{contractAddress}</code>
            </div>
            
            <div className="flex items-center border border-gray-mid rounded-sm p-3">
              <div className="mr-4">
                {formData.imageUrl && (
                  <div className="relative w-32 h-32 rounded-sm overflow-hidden">
                    <img 
                      src={displayImageUrl || getIPFSDisplayUrl(formData.imageUrl)} 
                      alt="Token" 
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        console.error("Image load error");
                        (e.target as HTMLImageElement).src = "/placeholder.png";
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm"><span className="font-medium">Name:</span> {formData.name}</p>
                <p className="text-sm"><span className="font-medium">Symbol:</span> {formData.symbol}</p>
                <p className="text-sm"><span className="font-medium">Category:</span> {formData.category}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 mt-5">
          <Button 
            onClick={() => {
              window.open(`https://basescan.org/address/${contractAddress}`, '_blank');
            }}
            fullWidth
            variant="outline"
            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            View on Basescan
          </Button>
          
          <Button 
            onClick={() => {
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
            }} 
            fullWidth
            className="bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
            Create Another Token
          </Button>
        </div>
      </div>
    );
  };
  
  // Render Get Started screen
  const renderGetStarted = () => (
    <div className="container-sm fade-in">
      <div className="get-started">
        <h2 className="text-lg font-bold mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5 mr-2 text-indigo-600">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Create Your Coin
        </h2>
        
        <div className="get-started-step">
          <div className="step-number">1</div>
          <div>
            <h3 className="font-medium mb-1">Describe Your Coin</h3>
            <p className="text-sm text-gray-dark">Select a category and describe your token's purpose and target audience</p>
          </div>
        </div>
        
        <div className="get-started-step">
          <div className="step-number">2</div>
          <div>
            <h3 className="font-medium mb-1">Customize Details</h3>
            <p className="text-sm text-gray-dark">Our AI will suggest a name and symbol that you can customize</p>
          </div>
        </div>
        
        <div className="get-started-step">
          <div className="step-number">3</div>
          <div>
            <h3 className="font-medium mb-1">Generate Image</h3>
            <p className="text-sm text-gray-dark">AI will create a unique image for your token based on your description</p>
          </div>
        </div>
        
        <div className="get-started-step">
          <div className="step-number">4</div>
          <div>
            <h3 className="font-medium mb-1">Create Token</h3>
            <p className="text-sm text-gray-dark">Launch your token on the blockchain with a single click</p>
          </div>
        </div>

        <Button 
          onClick={() => setStep(1)} 
          fullWidth
          size="lg"
          className="mt-6 bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800"
        >
          <span className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-2">
              <path d="M5 12h14"></path>
              <path d="M12 5l7 7-7 7"></path>
            </svg>
            Get Started
          </span>
        </Button>
      </div>
    </div>
  );
  
  return (
    <div className="w-full mx-auto px-4 pb-8 pt-2 max-w-2xl">
      {/* Modern header with Farcaster-style design */}
      <div className="mb-6">
        <div className="flex items-center justify-center">
          <div className="bg-gradient-to-r from-violet-500/20 via-indigo-500/30 to-blue-500/20 p-0.5 rounded-2xl shadow-lg">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 bg-gradient-to-br from-indigo-600 to-violet-700 p-2.5 rounded-xl shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                    <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"></path>
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-700">Coin Creator</h1>
                  <p className="text-xs text-gray-500">Create beautiful AI-powered tokens on Farcaster</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modern step indicator - only show if we're past the Get Started screen */}
      {step > 0 && (
        <div className="mb-6">
          <div className="relative flex justify-between items-center mb-2">
            {/* Connecting line between steps */}
            <div className="absolute left-0 right-0 h-0.5 bg-gray-200 top-1/2 transform -translate-y-1/2 z-0"></div>
            
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center relative z-10">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium ${
                  step === i 
                    ? "bg-indigo-600 text-white" 
                    : step > i 
                      ? "bg-indigo-500/70 text-white" 
                      : "bg-white text-gray-400 border border-gray-200"
                } transition-all duration-300`}>
                  {step > i ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    i
                  )}
                </div>
                {/* Minimal labels */}
                <span className={`text-xs mt-1 ${step === i ? 'text-indigo-600' : 'text-gray-500'}`}>
                  {i === 1 ? "Idea" : i === 2 ? "Details" : i === 3 ? "Preview" : "Mint"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Notifications */}
      {error && (
        <div className="mb-4 p-3 border border-red-300/20 bg-red-50/10 text-red-600 rounded-sm flex items-center text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 flex-shrink-0">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 border border-green-300/20 bg-green-50/10 text-green-600 rounded-sm flex items-center text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 flex-shrink-0">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <p>{success}</p>
        </div>
      )}
      
      {/* Step content */}
      <div className="animate-fade-in transition-all duration-300">
        {step === 0 && renderGetStarted()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
      
      {/* Back to Start button - moved to bottom */}
      {step > 0 && step < 4 && (
        <div className="mt-6 text-center">
          <Button 
            onClick={() => setStep(0)} 
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-indigo-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-1">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
            Back to Start
          </Button>
        </div>
      )}
    </div>
  );
}
