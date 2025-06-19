import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useAccount, usePublicClient } from "wagmi";
import { RetroButton } from "./ui/RetroButton";
import { getProfileBalance, getZoraProfile } from "../services/sdk/getProfiles.js";
import { validateTradeBalance } from "../services/sdk/getTradeCoin.js";
import { toast } from "react-hot-toast";
import CoinDetails from "./RetroCoinDetails";
import { resolveImageUrl } from "../utils/ipfs";
import { Camera } from "lucide-react";

interface TokenBalance {
  address: string;
  name: string;
  symbol: string;
  balance: string;
  rawBalance: string;
  imageUrl?: string;
  description?: string;
  totalSupply?: string;
  creatorAddress?: string;
  creatorName?: string;
  marketCap?: string;
  volumeDay?: string;
  holders?: number;
}

// User profile information
interface UserProfile {
  id?: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
  verified?: boolean;
  tokenBalance?: string;
}

// Define interface for profile data response
interface ZoraProfileData {
  id: string;
  handle: string;
  displayName?: string;
  avatar?: {
    previewImage?: {
      medium?: string;
    }
  };
  verified?: boolean;
  tokenBalance?: string;
  [key: string]: any; // Allow for additional properties
}

// Properly defined TypeScript interface for API response
interface ProfileBalanceResponse {
  data?: {
    profile?: {
      coinBalances?: {
        edges?: Array<{
          node: {
            balance: string;
            coin: {
              address: string;
              name: string;
              symbol: string;
              imageURI?: string;
              description?: string;
              totalSupply?: string;
              creatorAddress?: string;
              creatorProfile?: {
                handle: string;
              };
              mediaContent?: {
                previewImage?: {
                  medium?: string;
                },
                image?: {
                  medium?: string;
                }
              },
              marketCap?: string;
              volume24h?: string;
              uniqueHolders?: number;
            }
          }
        }>
      }
    }
  }
}

// TokenImage component to handle fallback cleanly
const TokenImage = ({ imageUrl, symbol, name }: { imageUrl?: string; symbol: string; name: string }) => {
  const [imageError, setImageError] = useState(false);
  const resolvedUrl = imageUrl ? resolveImageUrl(imageUrl) : '';

  if (!resolvedUrl || imageError) {
    return (
      <div className="w-10 h-10 bg-retro-primary/10 border border-retro-primary/50 flex items-center justify-center rounded">
        <Camera size={16} className="text-retro-primary" />
      </div>
    );
  }

  return (
    <Image 
      src={resolvedUrl} 
      alt={name} 
      width={40}
      height={40}
      className="w-10 h-10 rounded border border-retro-primary/50 pixelated"
      unoptimized
      onError={() => setImageError(true)}
    />
  );
};

export default function CoinHolderView() {
  const { address, isConnected } = useAccount();
  const [allTokens, setAllTokens] = useState<TokenBalance[]>([]);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [viewingDetails, setViewingDetails] = useState(false);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"balance" | "marketCap" | "holders" | "volume" | "name" | "usdValue">("usdValue");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [ethToUsdRate, setEthToUsdRate] = useState<number>(3000); // Add ETH price state
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const tokensPerPage = 10;

  // Fetch ETH price in USD
  const fetchEthPrice = React.useCallback(async () => {
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

  // Fetch ETH price on component mount
  React.useEffect(() => {
    fetchEthPrice();
  }, [fetchEthPrice]);

  // Check for token details navigation flag on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Function to check URL for token address
      const checkUrlForTokenAddress = () => {
        // Check if hash includes a token parameter
        const hash = window.location.hash;
        if (hash.includes('token=')) {
          try {
            const tokenParam = hash.split('token=')[1];
            const tokenAddress = tokenParam.split('&')[0]; // Get the token address part
            if (tokenAddress && tokenAddress.startsWith('0x')) {
              console.log('Found token address in URL:', tokenAddress);
              setSelectedTokenAddress(tokenAddress);
              setViewingDetails(true);
              return true;
            }
          } catch (e) {
            console.error('Error parsing token from URL:', e);
          }
        }
        return false;
      };

      // Check sessionStorage first
      const tokenAddress = sessionStorage.getItem('viewTokenAddress');
      const viewTokenDetails = sessionStorage.getItem('viewTokenDetails');
      
      if (tokenAddress && viewTokenDetails === 'true') {
        setSelectedTokenAddress(tokenAddress);
        setViewingDetails(true);
        // Clear the flag so we don't keep showing details on refresh
        sessionStorage.removeItem('viewTokenDetails');
      } else {
        // Try URL parameter as a fallback
        checkUrlForTokenAddress();
      }
      
      // Also listen for viewCoinDetails event which is fired from RetroSuccess component
      const handleViewCoinDetails = (event: CustomEvent) => {
        if (event.detail && event.detail.tokenAddress) {
          console.log('Received viewCoinDetails event:', event.detail.tokenAddress);
          setSelectedTokenAddress(event.detail.tokenAddress);
          setViewingDetails(true);
        }
      };
      
      // Add event listener
      window.addEventListener('viewCoinDetails', handleViewCoinDetails as EventListener);
      
      // Cleanup
      return () => {
        window.removeEventListener('viewCoinDetails', handleViewCoinDetails as EventListener);
      };
    }
  }, []);

  // Fetch user profile when connected
  useEffect(() => {
    if (isConnected && address) {
      fetchUserProfile(address);
    } else {
      setUserProfile(null);
    }
  }, [isConnected, address]);

  // Fetch user profile information
  const fetchUserProfile = async (walletAddress: string) => {
    setIsProfileLoading(true);
    setProfileError(null);
    
    try {
      // Get user profile from Zora API
      const profileResponse = await getZoraProfile(walletAddress);
      const profileData = profileResponse as ZoraProfileData;
      
      if (profileData) {
        // Extract avatar image URL from nested structure
        const avatarUrl = profileData.avatar?.previewImage?.medium || undefined;
        
        setUserProfile({
          id: profileData.id,
          handle: profileData.handle,
          displayName: profileData.displayName || profileData.handle,
          avatar: avatarUrl,
          verified: profileData.verified || false,
          tokenBalance: formatCurrency(profileData.tokenBalance) || "0"
        });
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      setProfileError("Could not load profile information. Please try again.");
    } finally {
      setIsProfileLoading(false);
    }
  };

  // Format date for display
  const formatDate = (timestamp?: string): string => {
    if (!timestamp) return "Unknown";
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return "Unknown";
    }
  };

  // Format currency values
  const formatCurrency = (value?: string): string => {
    if (!value) return "0";
    try {
      const num = parseFloat(value);
      if (isNaN(num)) return "0";
      
      if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
      if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
      if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
      if (num < 0.001 && num > 0) return "< 0.001";
      
      return num.toFixed(3);
    } catch (e) {
      return "0";
    }
  };

  // Calculate USD value of token balance - Fixed with proper decimal handling
  const calculateUSDValue = (token: TokenBalance): string => {
    try {
      // Use raw balance for accurate calculation (usually in wei format - 18 decimals)
      const rawBalance = parseFloat(token.rawBalance);
      
      if (isNaN(rawBalance) || rawBalance <= 0) return "0.00";
      
      // Convert from wei to readable format (assuming 18 decimals for most tokens)
      const balance = rawBalance / (10 ** 18);
      
      // Classic calculation: Token Price = Market Cap / Total Supply
      if (token.marketCap && token.totalSupply) {
        const marketCap = parseFloat(token.marketCap);
        const totalSupply = parseFloat(token.totalSupply);
        
        if (!isNaN(marketCap) && !isNaN(totalSupply) && totalSupply > 0 && marketCap > 0) {
          // Market cap is in USD, calculate token price
          const tokenPriceInUsd = marketCap / totalSupply;
          const usdValue = balance * tokenPriceInUsd;
          
          // Format with abbreviations
          if (usdValue >= 1_000_000_000) {
            return (usdValue / 1_000_000_000).toFixed(2) + 'B';
          } else if (usdValue >= 1_000_000) {
            return (usdValue / 1_000_000).toFixed(2) + 'M';
          } else if (usdValue >= 1_000) {
            return (usdValue / 1_000).toFixed(2) + 'K';
          } else if (usdValue >= 0.01) {
            return usdValue.toFixed(2);
          } else if (usdValue > 0) {
            return "< 0.01";
          }
        }
      }
      
      // If no market cap data available, return N/A
      return "N/A";
    } catch (e) {
      console.error("Error calculating USD value:", e);
      return "N/A";
    }
  };

  // Completely revised balance formatter to correctly handle all number formats
  const formatBalance = (rawBalance: string): string => {
    try {
      // Clean the string from commas, spaces, etc.
      const cleanStr = rawBalance.replace(/[^\d.-]/g, '');
      const num = parseFloat(cleanStr);
      
      if (isNaN(num)) return '0';
      
      // For extremely large numbers that might cause JS precision issues
      // First check if the string is very long (indicating potential huge number)
      if (cleanStr.length > 40) {
        // Extract the significant part by handling scientific notation properly
        const scientificStr = Number(cleanStr).toExponential();
        const parts = scientificStr.split('e+');
        if (parts.length === 2) {
          const significand = parseFloat(parts[0]);
          const exponent = parseInt(parts[1]);
          
          // Format based on exponent range
          if (exponent >= 24) return significand.toFixed(2) + 'T';
          if (exponent >= 21) return (significand * 1000).toFixed(2) + 'B';
          if (exponent >= 18) return (significand * 1000000).toFixed(2) + 'M';
        }
      }
      
      // Handle normal range numbers properly with limits
      if (num >= 1_000_000_000_000) { // Trillions
        return (num / 1_000_000_000_000).toFixed(2) + 'T';
      } else if (num >= 1_000_000_000) { // Billions
        return (num / 1_000_000_000).toFixed(2) + 'B';
      } else if (num >= 1_000_000) { // Millions
        return (num / 1_000_000).toFixed(2) + 'M';
      } else if (num >= 1_000) { // Thousands
        return (num / 1_000).toFixed(2) + 'K';
      } else if (num < 0.0001 && num > 0) {
        return '< 0.0001';
      } else if (num < 1) {
        return num.toFixed(4);
      }
      
      // Regular format for other numbers
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } catch (e) {
      console.error("Error formatting balance:", e);
      return '0';
    }
  };

  // Sort tokens function
  const sortTokens = (tokenList: TokenBalance[], sortBy: string, order: string): TokenBalance[] => {
    return [...tokenList].sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortBy) {
        case "balance":
          // Use raw balance for more accurate sorting
          aValue = parseFloat(a.rawBalance) || 0;
          bValue = parseFloat(b.rawBalance) || 0;
          break;
        case "marketCap":
          aValue = parseFloat(a.marketCap || "0");
          bValue = parseFloat(b.marketCap || "0");
          break;
        case "holders":
          aValue = a.holders || 0;
          bValue = b.holders || 0;
          break;
        case "volume":
          aValue = parseFloat(a.volumeDay || "0");
          bValue = parseFloat(b.volumeDay || "0");
          break;
        case "name":
          aValue = a.symbol.toLowerCase();
          bValue = b.symbol.toLowerCase();
          break;
        case "usdValue":
          // Use the improved calculateUSDValue function for comparison
          const aUsd = calculateUSDValue(a);
          const bUsd = calculateUSDValue(b);
          
          // Parse the USD values properly, handling abbreviations
          const parseUsdValue = (usdStr: string): number => {
            if (usdStr === "N/A" || usdStr === "< 0.01") return 0;
            
            const cleanStr = usdStr.replace(/[^\d.-]/g, '');
            let value = parseFloat(cleanStr) || 0;
            
            if (usdStr.includes('B')) value *= 1_000_000_000;
            else if (usdStr.includes('M')) value *= 1_000_000;
            else if (usdStr.includes('K')) value *= 1_000;
            
            return value;
          };
          
          aValue = parseUsdValue(aUsd);
          bValue = parseUsdValue(bUsd);
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return order === "desc" ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
      }

      return order === "desc" ? (bValue as number) - (aValue as number) : (aValue as number) - (bValue as number);
    });
  };

  // Filter tokens based on search query
  useEffect(() => {
    let filteredTokens = allTokens;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase().trim();
      filteredTokens = allTokens.filter(token => 
        token.name.toLowerCase().includes(lowerQuery) || 
        token.symbol.toLowerCase().includes(lowerQuery) ||
        token.address.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Apply sorting
    const sortedTokens = sortTokens(filteredTokens, sortBy, sortOrder);
    
    // Reset to first page when filtering/sorting
    setCurrentPage(1);
    setTokens(getPageTokens(sortedTokens, 1));
  }, [searchQuery, allTokens, sortBy, sortOrder]);

  // Get tokens for current page
  const getPageTokens = (tokenArray: TokenBalance[], page: number) => {
    const startIndex = (page - 1) * tokensPerPage;
    return tokenArray.slice(startIndex, startIndex + tokensPerPage);
  };

  // Handle page change with sorting
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    
    let filteredTokens = allTokens;
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase().trim();
      filteredTokens = allTokens.filter(token => 
        token.name.toLowerCase().includes(lowerQuery) || 
        token.symbol.toLowerCase().includes(lowerQuery) ||
        token.address.toLowerCase().includes(lowerQuery)
      );
    }
    
    const sortedTokens = sortTokens(filteredTokens, sortBy, sortOrder);
    setTokens(getPageTokens(sortedTokens, page));
  };

  // Calculate total pages with sorting
  const getTotalPages = () => {
    let filteredTokens = allTokens;
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase().trim();
      filteredTokens = allTokens.filter(token => 
        token.name.toLowerCase().includes(lowerQuery) || 
        token.symbol.toLowerCase().includes(lowerQuery) ||
        token.address.toLowerCase().includes(lowerQuery)
      );
    }
    return Math.ceil(filteredTokens.length / tokensPerPage);
  };

  // Reload balances
  const handleReloadBalances = () => {
    if (isConnected && address) {
      fetchTokenBalances(address);
    }
  };

  // Fetch user's token balances
  const fetchTokenBalances = async (walletAddress: string) => {
    setIsLoading(true);
    try {
      const response = await getProfileBalance(walletAddress) as ProfileBalanceResponse;
      
      if (response?.data?.profile?.coinBalances?.edges) {
        const balances = response.data.profile.coinBalances.edges
          .filter(edge => edge.node && edge.node.coin && parseFloat(edge.node.balance) > 0)
          .map(edge => {
            return {
              address: edge.node.coin.address,
              name: edge.node.coin.name,
              symbol: edge.node.coin.symbol,
              balance: formatBalance(edge.node.balance),
              rawBalance: edge.node.balance,
              imageUrl: edge.node.coin.imageURI || 
                       edge.node.coin.mediaContent?.previewImage?.medium ||
                       edge.node.coin.mediaContent?.image?.medium,
              description: edge.node.coin.description,
              totalSupply: edge.node.coin.totalSupply,
              creatorAddress: edge.node.coin.creatorAddress,
              creatorName: edge.node.coin.creatorProfile?.handle,
              marketCap: edge.node.coin.marketCap,
              volumeDay: edge.node.coin.volume24h,
              holders: edge.node.coin.uniqueHolders
            };
          });
        
        setAllTokens(balances);
        setTokens(getPageTokens(balances, currentPage));
      } else {
        // Handle empty response or API format changes
        console.warn("Profile balance response format unexpected:", response);
        toast.error("Unable to load token balances - unexpected data format");
        setAllTokens([]);
        setTokens([]);
      }
    } catch (error) {
      console.error("Failed to fetch token balances:", error);
      toast.error("Failed to load your tokens. Please try again.");
      setAllTokens([]);
      setTokens([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load token balances on connect
  useEffect(() => {
    if (isConnected && address) {
      fetchTokenBalances(address);
    } else {
      // Reset state when not connected
      setAllTokens([]);
      setTokens([]);
    }
  }, [isConnected, address]);

  const handleTokenClick = (tokenAddress: string) => {
    setSelectedTokenAddress(tokenAddress);
    setViewingDetails(true);
  };

  const handleBackFromDetails = () => {
    setViewingDetails(false);
    setSelectedTokenAddress(undefined);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Retry profile fetch
  const handleRetryProfile = () => {
    if (address) {
      fetchUserProfile(address);
    }
  };

  if (viewingDetails && selectedTokenAddress) {
    return <CoinDetails coinAddress={selectedTokenAddress} onBack={handleBackFromDetails} />;
  }

  return (
    <div className="retro-container p-2 border-2 border-retro-primary">
      {/* Header with enhanced styling */}
      <div className="mb-4 bg-gradient-to-r from-retro-primary/20 to-retro-primary/5 p-3 border-2 border-retro-primary shadow-[0_0_10px_rgba(255,107,53,0.1)]">
        <h2 className="retro-header text-sm mb-0 text-retro-primary font-bold pixelated flex items-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          YOUR PORTFOLIO
        </h2>
      </div>
      
      {/* Profile section with modern retro design */}
      <div className="mb-4">
        {isConnected ? (
          <>
            {isProfileLoading ? (
              <div className="flex justify-center my-4 bg-black/20 p-4 border-2 border-retro-primary">
                <div className="retro-loading">
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
              </div>
            ) : profileError ? (
              <div className="text-center py-4 bg-gradient-to-br from-red-900/20 to-black/40 border-2 border-red-400">
                <p className="text-red-400 text-xs mb-3 pixelated">{profileError}</p>
                <RetroButton
                  onClick={handleRetryProfile}
                  className="text-xs py-2 px-4 bg-red-500 hover:bg-red-400 border-red-400"
                >
                  RETRY CONNECTION
                </RetroButton>
              </div>
            ) : userProfile ? (
              <div className="bg-gradient-to-br from-retro-primary/10 via-retro-primary/5 to-black/40 p-4 border-2 border-retro-primary shadow-[0_0_15px_rgba(255,107,53,0.2)]">
                <div className="flex items-center gap-4">
                  {userProfile.avatar && resolveImageUrl(userProfile.avatar) ? (
                    <Image 
                      src={resolveImageUrl(userProfile.avatar)}
                      alt={userProfile.displayName || "Profile"} 
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-lg border-2 border-retro-primary shadow-[0_0_8px_rgba(255,107,53,0.3)] pixelated"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentNode as HTMLElement;
                        if (parent) {
                          parent.innerHTML = '<div class="w-14 h-14 rounded-lg bg-retro-primary/20 border-2 border-retro-primary flex items-center justify-center shadow-[0_0_8px_rgba(255,107,53,0.3)]"><span class="text-retro-primary text-xl font-bold pixelated">📷</span></div>';
                        }
                      }}
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-retro-primary/20 border-2 border-retro-primary flex items-center justify-center shadow-[0_0_8px_rgba(255,107,53,0.3)]">
                      <span className="text-retro-primary text-xl font-bold pixelated">
                        {userProfile.displayName?.charAt(0) || address?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <h3 className="text-lg font-bold text-retro-primary mr-2 pixelated">
                        {userProfile.displayName || "Anonymous Holder"}
                      </h3>
                      {userProfile.verified && (
                        <div className="w-5 h-5 bg-retro-primary rounded-full flex items-center justify-center">
                          <span className="text-black text-xs font-bold">✓</span>
                        </div>
                      )}
                    </div>
                    
                    {userProfile.handle && (
                      <div className="text-sm text-retro-secondary mb-2 font-mono">@{userProfile.handle}</div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-retro-accent font-mono bg-black/30 px-2 py-1 border border-retro-primary/30 rounded">
                          {address ? `${address.substring(0, 8)}...${address.substring(address.length - 6)}` : 'N/A'}
                        </span>
                        <button
                          onClick={() => navigator.clipboard.writeText(address || '')}
                          className="text-retro-accent hover:text-retro-primary transition-colors"
                          title="Copy address"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                
                </div>
              </div>
            ) : (
              <div className="text-center py-4 border-2 border-retro-primary bg-black/20">
                <p className="text-xs text-retro-secondary pixelated">NO PROFILE DATA AVAILABLE</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 border-2 border-retro-primary bg-gradient-to-br from-retro-primary/5 to-black/40">
            <div className="w-16 h-16 mx-auto mb-4 bg-retro-primary/20 border-2 border-retro-primary rounded-lg flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-retro-primary">
                <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>
                <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>
              </svg>
            </div>
            <p className="text-sm text-retro-primary mb-2 pixelated font-bold">WALLET NOT CONNECTED</p>
            <p className="text-xs text-retro-secondary">Connect your wallet to view your token portfolio</p>
          </div>
        )}
      </div>
      
      {/* Enhanced search bar and controls */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative ">
          
          <input
            type="text"
            className="retro-input w-full text-xs py-2 pl-8 pr-3 border-2 border-retro-primary bg-black/60 text-retro-accent placeholder-retro-secondary/60"
            placeholder="Search by name, symbol, or address..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute right-2 top-1/2 transform -translate-y-1/2 text-retro-secondary">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          
        </div>
        <RetroButton 
          onClick={handleReloadBalances}
          isLoading={isLoading}
          className="flex items-center text-xs py-2 px-3 bg-retro-primary hover:bg-retro-primary/80 border-retro-primary transition-all duration-200"
          disabled={!isConnected}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
         
        </RetroButton>
      </div>

      {/* Filter/Sort Options */}
      {isConnected && allTokens.length > 0 && (
        <div className="mb-3 bg-black/20 p-2 border border-retro-primary">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-retro-secondary pixelated">SORT BY:</span>
            
            {/* Sort by dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs px-2 py-1 bg-black/60 border border-retro-primary text-retro-accent focus:border-retro-accent focus:outline-none"
            >
              <option value="usdValue">USD VALUE</option>
              <option value="balance">TOKEN AMOUNT</option>
              <option value="marketCap">MARKET CAP</option>
              <option value="holders">HOLDERS</option>
              <option value="volume">24H VOLUME</option>
              <option value="name">NAME (A-Z)</option>
            </select>
            
            {/* Sort order dropdown */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="text-xs px-2 py-1 bg-black/60 border border-retro-primary text-retro-accent focus:border-retro-accent focus:outline-none"
            >
              <option value="desc">HIGH TO LOW</option>
              <option value="asc">LOW TO HIGH</option>
            </select>
          </div>
        </div>
      )}
      
      {/* Results info */}
      {isConnected && !isLoading && (
        <div className="mb-3 flex justify-between items-center text-xs">
          <span className="text-retro-secondary pixelated">
            {searchQuery.trim() ? `SEARCH RESULTS: ${tokens.length}` : `TOTAL TOKENS: ${allTokens.length}`}
          </span>
          {searchQuery.trim() && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-retro-accent hover:text-retro-primary transition-colors pixelated"
            >
              CLEAR SEARCH
            </button>
          )}
        </div>
      )}
      
      {/* Modern token holdings grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8 border-2 border-retro-primary bg-black/20">
          <div className="retro-loading mb-4">
            <div></div>
            <div></div>
            <div></div>
          </div>
          <p className="text-retro-secondary text-xs pixelated">LOADING PORTFOLIO...</p>
        </div>
      ) : tokens.length > 0 ? (
        <div className="grid grid-cols-1 gap-2">
          {tokens.map((token, index) => (
            <div
              key={token.address}
              className="group bg-black/40 p-3 border border-retro-primary hover:border-retro-accent transition-all duration-200 cursor-pointer hover:bg-retro-primary/5"
              onClick={() => handleTokenClick(token.address)}
            >
              <div className="flex items-center gap-3">
                {/* Token Icon */}
                <TokenImage imageUrl={token.imageUrl} symbol={token.symbol} name={token.name} />
                
                {/* Token Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-retro-primary pixelated">
                        {token.symbol.length > 8 ? `${token.symbol.substring(0, 8)}...` : token.symbol}
                      </h3>
                      <span className="text-xs text-retro-secondary font-mono truncate max-w-[100px]">
                        {token.name.length > 15 ? `${token.name.substring(0, 15)}...` : token.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-retro-accent pixelated">
                        ${calculateUSDValue(token)}
                      </div>
                      <div className="text-xs text-retro-secondary opacity-60">
                        {token.balance} {token.symbol}
                      </div>
                    </div>
                  </div>
                  
                  {/* Compact metrics row */}
                  <div className="flex items-center gap-4 mt-1 text-xs text-retro-secondary">
                    {token.marketCap && (
                      <span>
                        <span className="opacity-60">MC:</span> ${formatCurrency(token.marketCap)}
                      </span>
                    )}
                    {token.volumeDay && (
                      <span>
                        <span className="opacity-60">24H:</span> ${formatCurrency(token.volumeDay)}
                      </span>
                    )}
                    {token.holders !== undefined && (
                      <span className="flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        {token.holders.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-retro-primary bg-gradient-to-br from-retro-primary/5 to-black/40">
          <div className="w-16 h-16 mx-auto mb-4 bg-retro-primary/20 border-2 border-retro-primary rounded-lg flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-retro-primary">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="text-retro-primary mb-2 pixelated font-bold">NO TOKENS FOUND</p>
          <p className="text-xs text-retro-secondary">
            {isConnected 
              ? searchQuery.trim() 
                ? "Try adjusting your search terms" 
                : "Start trading to build your token portfolio"
              : "Connect your wallet to view your token holdings"}
          </p>
        </div>
      )}
      
      {/* Enhanced Pagination */}
      {tokens.length > 0 && getTotalPages() > 1 && (
        <div className="flex justify-center items-center gap-3 mt-6 p-3 bg-black/20 border-2 border-retro-primary">
          <RetroButton
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="text-xs py-2 px-3 bg-transparent border-retro-primary hover:bg-retro-primary/20 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            PREV
          </RetroButton>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-retro-secondary pixelated">PAGE</span>
            <span className="text-sm text-retro-primary font-bold pixelated bg-retro-primary/20 px-2 py-1 border border-retro-primary">
              {currentPage}
            </span>
            <span className="text-xs text-retro-secondary pixelated">OF {getTotalPages()}</span>
          </div>
          
          <RetroButton
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === getTotalPages()}
            className="text-xs py-2 px-3 bg-transparent border-retro-primary hover:bg-retro-primary/20 transition-all"
          >
            NEXT
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </RetroButton>
        </div>
      )}
    </div>
  );
} 
