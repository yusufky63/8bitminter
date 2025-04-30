"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useConnect } from "wagmi";
// Kullanılmayan importları kaldırdık
import { Button } from "./ui/Button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { getCoinCategories } from "../services/aiService.js";
import { toast } from "react-hot-toast";
import { generateImageWithAI } from "../services/aiService";
import { processTtlgenHerImage } from "../services/imageUtils";
import { getIPFSDisplayUrl } from "../services/imageUtils";

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
  
  // AI generations
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [creatingImage, setCreatingImage] = useState(false);
  
  // Wallet connection
  const { address, isConnected } = useAccount();
  // const { data: walletClient } = useWalletClient();
  // const publicClient = usePublicClient();
  const { connect, connectors } = useConnect();
  
  // Contract address
  const [contractAddress, setContractAddress] = useState<string>("");
  
  // Token image gösterimi için display URL state'i
  const [displayImageUrl, setDisplayImageUrl] = useState<string>("");
  
  // Handle coin creation with useCallback
  const handleCreateCoin = useCallback(async () => {
    console.log("Creating coin with data:", formData);
    
    // Mock implementation for example
    setIsLoading(true);
    setError("");
    
    try {
      // Simulate API call or blockchain interaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate a mock contract address for demo
      const mockContractAddress = "0x" + Array.from({length: 40}, () => 
        Math.floor(Math.random() * 16).toString(16)).join('');
      
      // Set the contract address
      setContractAddress(mockContractAddress);
      
      // Set success message
      setSuccess(`Coin ${formData.name} (${formData.symbol}) created successfully!`);
      
      // Move to the next step
      setStep(4);
    } catch (error) {
      console.error("Error creating coin:", error);
      setError(`Failed to create coin: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  }, [formData, setIsLoading, setError, setContractAddress, setSuccess, setStep]);
  
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
          const sdkModule = await import('@farcaster/frame-sdk');
          farcasterSDK.current = sdkModule.sdk as FarcasterSDK;
          console.log("Farcaster SDK imported successfully");
        } catch (importError) {
          console.error("Failed to import Farcaster SDK:", importError);
          return;
        }

        if (!farcasterSDK.current) {
          console.warn("Farcaster SDK not available");
          return;
        }
        
        // Olayları dinlemeye çalış
        try {
          // Farcaster SDK tipinde events.on mevcut değil, bu yüzden tip kontrolünü devre dışı bırakmak için cast kullanıyoruz
          const sdk = farcasterSDK.current as any;
          if (sdk?.events?.on) {
            sdk.events.on("primaryButtonClicked", () => {
              console.log("Primary button clicked event received");
              if (step === 0) {
                setStep(1);
              } else if (step === 3) {
                handleCreateCoin();
              }
            });
            console.log("✅ Primary button click event listener set up");
          }
        } catch (eventError) {
          console.warn("Failed to set up Farcaster events:", eventError);
        }
        
        // SDK'yı hazır hale getir ve splash screen'i gizle
        try {
          if (farcasterSDK.current?.actions?.ready) {
            console.log("Calling SDK ready...");
            await farcasterSDK.current.actions.ready();
            console.log("✅ Farcaster SDK ready, splash screen hidden");
          }
        } catch (readyError) {
          console.error("Failed to call SDK ready:", readyError);
        }
        
        // Primary buton'u ayarlamaya çalış
        try {
          if (farcasterSDK.current?.actions?.setPrimaryButton) {
            await farcasterSDK.current.actions.setPrimaryButton({ 
              text: "Get Started" 
            });
            console.log("✅ Primary button set");
          }
        } catch (buttonError) {
          console.warn("Failed to set primary button:", buttonError);
        }
        
        // Başlatıldı olarak işaretle
        sdkInitialized.current = true;
        console.log("✅ Farcaster SDK initialization complete");
        
      } catch (err) {
        console.error("❌ Failed to initialize Farcaster SDK:", err);
      }
    };
    
    // Run initialization when content is ready
    if (isContentReady) {
      initFarcasterSDK();
    }
  }, [isContentReady, step, handleCreateCoin]);
  
  // Respond to step changes in UI
  useEffect(() => {
    if (!sdkInitialized.current || typeof window === 'undefined' || !farcasterSDK.current) return;
    
    // When step changes, try to update the primary button if available
    const updateUI = async () => {
      try {
        if (farcasterSDK.current?.actions?.setPrimaryButton) {
          if (step === 0) {
            await farcasterSDK.current.actions.setPrimaryButton({ text: "Get Started" });
          } else if (step === 3) { // Preview step
            await farcasterSDK.current.actions.setPrimaryButton({ text: "Create Token" });
          } else {
            // Use a generic text for other steps
            await farcasterSDK.current.actions.setPrimaryButton({ text: "Continue" });
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
  
  // Generate AI suggestions for token name and description
  const generateAiSuggestions = async () => {
    if (!formData.category || !formData.description) {
      setError("Please select a category and provide a description");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "text",
          category: formData.category,
          description: formData.description
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      setAiSuggestion(data);
      
      // Populate form with AI suggestions
      setFormData({
        ...formData,
        name: data.name || formData.name,
        symbol: data.symbol || formData.symbol
      });
      
      // Move to next step
      setStep(2);
    } catch (error) {
      console.error("Error generating AI suggestions:", error);
      setError("Failed to generate AI suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Generate token image with AI
  const generateTokenImage = async () => {
    try {
      setCreatingImage(true);
      setError("");

      if (!formData.name || !formData.symbol || !formData.description) {
        throw new Error("Token name, symbol and description are required");
      }

      // Create a concise prompt for image generation
      const prompt = `Create clean, minimal 3D crypto token image for ${formData.name} (${formData.symbol}). Modern, professional design with vibrant colors. Suitable as NFT/crypto logo. No text.`;

      // Pass a single prompt parameter to the updated function
      const imageUrl = await generateImageWithAI(prompt);
      console.log("Raw image URL from AI:", imageUrl);

      // Process the IPFS URI
      const processedUri = await processTtlgenHerImage(imageUrl);
      console.log("Processed IPFS URI:", processedUri);
      
      // Get the HTTP Gateway URL for display
      const httpUrl = getIPFSDisplayUrl(processedUri);
      console.log("Display URL:", httpUrl);

      // Update form state
      setFormData((prev) => ({
        ...prev,
        imageUrl: processedUri, // Store IPFS URI in form data
      }));
      
      // Store display URL in separate state
      setDisplayImageUrl(httpUrl);

      setCreatingImage(false);
      
      // Advance to the next step after successful image generation
      setStep(3);
    } catch (error: any) {
      console.error("Error generating token image:", error);
      setError(`Error generating token image: ${error.message}`);
      setCreatingImage(false);
    }
  };
  
  // Connect wallet
  const connectWallet = async () => {
    try {
      setError("");
      
      // Check if running in development environment to provide mock wallet behavior
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log("Running in development mode with mock wallet functionality");
        // Create mock wallet connection for development testing
        const mockAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
        
        // Log the mock connection
        console.log("Connected with mock wallet address:", mockAddress);
        toast.success(`Connected to mock wallet: ${mockAddress.substring(0, 6)}...${mockAddress.substring(38)}`);
        
        // Return early since we're using a mock connection
        return;
      }
      
      if (!farcasterSDK.current) {
        setError("Farcaster SDK not initialized. Please refresh the page and try again.");
        return;
      }
      
      // First, try using Wagmi hooks which is the recommended approach
      if (connectors && connectors.length > 0) {
        console.log("Connecting with Farcaster frame-wagmi-connector...");
        try {
          // Use the Farcaster frame-wagmi-connector
          await connect({ connector: connectors[0] });
          console.log("Wagmi connection successful");
          
          // After connection, isConnected and address should be updated via hooks
          if (isConnected && address) {
            console.log("Connected successfully with address:", address);
            return;
          }
        } catch (wagmiError) {
          console.warn("Wagmi connection failed:", wagmiError);
          // Continue to fallback method
        }
      }
      
      // Fallback to direct SDK method - this is a reliable fallback
      const sdk = farcasterSDK.current as any;
      if (!sdk?.wallet?.ethProvider) {
        console.warn("Wallet provider not available, likely not running in Farcaster client");
        // For demonstration purposes in development/testing, proceed with mock connection
        if (process.env.NODE_ENV === 'development') {
          const mockAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
          toast.success(`Connected to mock wallet: ${mockAddress.substring(0, 6)}...${mockAddress.substring(38)}`);
          return;
        } else {
          setError("Wallet provider not available. Please ensure you're using Warpcast or another Farcaster client.");
          return;
        }
      }
      
      console.log("Connecting with direct eth_requestAccounts method...");
      try {
        // Safely request accounts with better error handling
        const accounts = await sdk.wallet.ethProvider.request({ 
          method: 'eth_requestAccounts' 
        }).catch((err: unknown) => {
          console.error("eth_requestAccounts error:", err);
          throw new Error(err instanceof Error ? err.message : "Failed to request accounts");
        });
        
        console.log("Connected accounts:", accounts);
        
        if (accounts && accounts.length > 0) {
          toast.success(`Connected to wallet: ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`);
        } else {
          throw new Error("No accounts returned from wallet");
        }
      } catch (ethError) {
        console.error("Direct eth connection failed:", ethError);
        
        // In development, provide a fallback mock wallet
        if (process.env.NODE_ENV === 'development') {
          console.log("Using mock wallet for development");
          const mockAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
          toast.success(`Connected to mock wallet: ${mockAddress.substring(0, 6)}...${mockAddress.substring(38)}`);
          return;
        }
        
        setError(`Wallet connection failed: ${ethError instanceof Error ? ethError.message : "Unknown error"}`);
        throw ethError;
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // For development environment, don't show error and use mock wallet
      if (process.env.NODE_ENV === 'development') {
        console.log("Using mock wallet instead of showing error");
        const mockAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
        toast.success(`Connected to mock wallet: ${mockAddress.substring(0, 6)}...${mockAddress.substring(38)}`);
        return;
      }
      
      setError(`Failed to connect wallet: ${errorMessage}. Please try again.`);
    }
  };
  
  // Render step 1 - Category and description selection
  const renderStep1 = () => (
    <div className="container-sm fade-in">
      <div className="card border border-gray-mid shadow-sm transition-all">
        {/* Step heading */}
        <div className="flex items-center mb-5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <h2 className="text-lg font-bold">Create Your Coin</h2>
        </div>
        
        {/* Category selection */}
        <div className="mb-5">
          <Label htmlFor="category" className="text-foreground flex items-center mb-2 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-primary">
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-primary">
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
        <div className="p-3 bg-accent/5 border border-accent/10 rounded-lg flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-accent mt-0.5 mr-2 flex-shrink-0">
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
        className="mt-5"
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
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          </div>
          <h2 className="text-lg font-bold">Coin Details</h2>
        </div>
        
        {/* AI suggestion */}
        {aiSuggestion && (
          <div className="mb-5 overflow-hidden rounded-lg border border-primary/10">
            <div className="bg-primary/5 p-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary mr-2">
                <path d="M12 2a10 10 0 0 1 10 10c0 5.5-5 7-10 13-5-6-10-7.5-10-13A10 10 0 0 1 12 2z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <h3 className="text-sm font-medium text-foreground">AI Suggestion</h3>
            </div>
            <div className="p-3 bg-white">
              <p className="text-sm text-gray-dark">{aiSuggestion.description}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {aiSuggestion.category}
                </span>
                {aiSuggestion.features && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-primary">
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-primary">
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
        <div className="p-3 bg-accent/5 border border-accent/10 rounded-lg">
          <h4 className="text-sm font-medium text-foreground mb-1 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-accent">
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
    return (
      <div className="container-sm fade-in">
        <div className="card border border-gray-mid shadow-sm transition-all">
          <div className="flex items-center mb-5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary">
                <path d="M12 22s8-4 8-10V4l-8-2-8 2v8c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold">Create Your Token</h2>
          </div>
          
          <div className="mb-5">
            <h3 className="text-sm font-medium mb-3">Token Preview</h3>
            <div className="rounded-lg overflow-hidden border border-gray-mid p-4">
              {formData.imageUrl && (
                <div className="mb-4 flex justify-center">
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden">
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
          
          {!isConnected && (
            <div className="mb-5 p-3 bg-accent/5 border border-accent/10 rounded-lg">
              <p className="text-sm mb-2 font-medium">Connect your wallet to create your token</p>
              <Button 
                onClick={connectWallet} 
                variant="outline"
                size="sm"
                className="border-primary text-primary"
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
            disabled={isLoading || !formData.name || !formData.symbol || !formData.imageUrl}
          >
            <span className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
              Create Token
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
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-success">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h2 className="text-lg font-bold">Congratulations!</h2>
          </div>
          
          <div className="p-3 mb-5 rounded-lg bg-success/5 border border-success/10">
            <p className="text-sm">{success}</p>
          </div>
          
          <div className="mb-5">
            <h3 className="text-sm font-medium mb-3">Contract Details</h3>
            <div className="p-3 rounded-lg bg-gray-light mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Contract Address:</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(contractAddress);
                    toast.success("Address copied to clipboard!");
                  }}
                  className="p-1 hover:bg-gray-mid rounded"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
              </div>
              <code className="block mt-2 text-xs p-2 rounded bg-white overflow-x-auto border border-gray-mid">{contractAddress}</code>
            </div>
            
            <div className="flex items-center border border-gray-mid rounded-lg p-3">
              <div className="mr-4">
                {formData.imageUrl && (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden">
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
              window.open(`https://testnets.opensea.io/assets/sepolia/${contractAddress}/1`, '_blank');
            }}
            fullWidth
            variant="outline"
            className="border-primary text-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            View on OpenSea
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
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5 mr-2 text-primary">
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
          className="mt-6"
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
          <div className="bg-gradient-to-r from-blue-500/20 via-primary/30 to-purple-500/20 p-0.5 rounded-2xl">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 bg-gradient-to-r from-primary to-blue-600 p-2 rounded-xl shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                    <path d="M12 18V6" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">VisionZ Coin</h1>
                  <p className="text-xs text-gray-500">Create AI-powered tokens on Farcaster</p>
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
                    ? "bg-primary text-white" 
                    : step > i 
                      ? "bg-primary/70 text-white" 
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
                <span className={`text-xs mt-1 ${step === i ? 'text-primary' : 'text-gray-500'}`}>
                  {i === 1 ? "Idea" : i === 2 ? "Details" : i === 3 ? "Preview" : "Mint"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Notifications */}
      {error && (
        <div className="mb-4 p-3 border border-error/20 bg-error/10 text-error rounded-lg flex items-center text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 flex-shrink-0">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 border border-success/20 bg-success/10 text-success rounded-lg flex items-center text-sm">
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
            className="text-gray-500 hover:text-primary"
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