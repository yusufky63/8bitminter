import React, { useState, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { RetroButton } from "./ui/RetroButton";
import { getProfileBalance, getZoraProfile } from "../services/sdk/getProfiles.js";
import { validateTradeBalance } from "../services/sdk/getTradeCoin.js";
import { toast } from "react-hot-toast";
import CoinDetails from "./CoinDetails";

interface TokenBalance {
  address: string;
  name: string;
  symbol: string;
  balance: string;
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

export default function CoinHolderView() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [allTokens, setAllTokens] = useState<TokenBalance[]>([]);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [viewingDetails, setViewingDetails] = useState(false);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const tokensPerPage = 10;

  // Initialize app without Farcaster SDK
  useEffect(() => {
    const initApp = async () => {
      // Basic app initialization if needed
    };
    
    initApp();
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

  // Filter tokens based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      // If no search query, just use pagination on all tokens
      setTokens(getPageTokens(allTokens, currentPage));
      return;
    }
    
    const lowerQuery = searchQuery.toLowerCase().trim();
    const filtered = allTokens.filter(token => 
      token.name.toLowerCase().includes(lowerQuery) || 
      token.symbol.toLowerCase().includes(lowerQuery) ||
      token.address.toLowerCase().includes(lowerQuery)
    );
    
    setCurrentPage(1); // Reset to first page when searching
    setTokens(getPageTokens(filtered, 1));
  }, [searchQuery, allTokens, currentPage]);

  // Get tokens for current page
  const getPageTokens = (tokenArray: TokenBalance[], page: number) => {
    const startIndex = (page - 1) * tokensPerPage;
    return tokenArray.slice(startIndex, startIndex + tokensPerPage);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (!searchQuery.trim()) {
      setTokens(getPageTokens(allTokens, page));
    } else {
      // If there's a search query, we need to filter first
      const lowerQuery = searchQuery.toLowerCase().trim();
      const filtered = allTokens.filter(token => 
        token.name.toLowerCase().includes(lowerQuery) || 
        token.symbol.toLowerCase().includes(lowerQuery) ||
        token.address.toLowerCase().includes(lowerQuery)
      );
      setTokens(getPageTokens(filtered, page));
    }
  };

  // Calculate total pages
  const getTotalPages = () => {
    if (!searchQuery.trim()) {
      return Math.ceil(allTokens.length / tokensPerPage);
    } else {
      const lowerQuery = searchQuery.toLowerCase().trim();
      const filtered = allTokens.filter(token => 
        token.name.toLowerCase().includes(lowerQuery) || 
        token.symbol.toLowerCase().includes(lowerQuery) ||
        token.address.toLowerCase().includes(lowerQuery)
      );
      return Math.ceil(filtered.length / tokensPerPage);
    }
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
          .map(edge => ({
            address: edge.node.coin.address,
            name: edge.node.coin.name,
            symbol: edge.node.coin.symbol,
            balance: formatBalance(edge.node.balance),
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
          }));
        
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
    <div className="retro-container p-2">
      <h2 className="retro-header text-sm mb-3">Your Token Holdings</h2>
      
      {/* Profile section */}
      <div className="mb-4">
        {isConnected ? (
          <>
            {isProfileLoading ? (
              <div className="flex justify-center my-2">
                <div className="retro-loading">
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
              </div>
            ) : profileError ? (
              <div className="text-center py-2">
                <p className="text-retro-error text-xs mb-2">{profileError}</p>
                <RetroButton
                  onClick={handleRetryProfile}
                  className="text-xs py-1"
                >
                  Retry
                </RetroButton>
              </div>
            ) : userProfile ? (
              <div className="retro-card p-2 mb-3">
                <div className="flex items-center gap-3">
                  {userProfile.avatar ? (
                    <img 
                      src={userProfile.avatar}
                      alt={userProfile.displayName || "Profile"} 
                      className="w-12 h-12 rounded-full border-2 border-retro-primary"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = "https://i.imgur.com/HeIi0wU.png"; // Default avatar
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-retro-dark border-2 border-retro-primary flex items-center justify-center">
                      <span className="text-retro-primary text-lg font-bold">
                        {userProfile.displayName?.charAt(0) || address?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-sm font-bold text-retro-primary mr-1">
                        {userProfile.displayName || "Anonymous"}
                      </h3>
                      {userProfile.verified && (
                        <span className="text-xs text-retro-accent">✓</span>
                      )}
                    </div>
                    
                    {userProfile.handle && (
                      <div className="text-xs text-retro-secondary">@{userProfile.handle}</div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-y-1 mt-2 text-xs">
                      <div>
                        <span className="text-retro-secondary">Address:</span>{" "}
                        <span className="text-retro-accent truncate max-w-[120px] inline-block align-bottom">
                          {address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-2 mb-2 border border-retro-primary bg-retro-dark/20">
                <p className="text-xs text-retro-secondary">No profile information available</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-3 mb-2 border border-retro-primary bg-retro-dark/20">
            <p className="text-sm text-retro-secondary mb-2">Connect your wallet to view your profile and token holdings</p>
          </div>
        )}
      </div>
      
      {/* Search bar and reload button */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <input
            type="text"
            className="retro-input w-full text-xs py-1"
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        <RetroButton 
          onClick={handleReloadBalances}
          isLoading={isLoading}
          className="text-xs py-1"
          disabled={!isConnected}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="mr-1">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        
        </RetroButton>
      </div>
      
      {/* Token holdings list */}
      {isLoading ? (
        <div className="flex justify-center my-4">
          <div className="retro-loading">
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
      ) : tokens.length > 0 ? (
        <div className="space-y-2">
          {tokens.map((token, index) => (
            <div
              key={token.address}
              className="retro-card p-2 hover:border-retro-accent transition-colors cursor-pointer"
              onClick={() => handleTokenClick(token.address)}
            >
              <div className="flex items-center gap-2">
                {token.imageUrl ? (
                  <img 
                    src={token.imageUrl} 
                    alt={token.name} 
                    className="w-10 h-10 rounded-md pixelated"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.style.display = "none";
                      const parent = target.parentNode;
                      if (parent) {
                        const placeholder = document.createElement("div");
                        placeholder.className = "w-10 h-10 bg-retro-primary/5 flex items-center justify-center rounded-md";
                        placeholder.innerHTML = `<span class="text-retro-primary text-md font-bold">${token.symbol.charAt(0)}</span>`;
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 bg-retro-primary/5 flex items-center justify-center rounded-md">
                    <span className="text-retro-primary text-md font-bold">{token.symbol.charAt(0)}</span>
                  </div>
                )}
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-retro-primary">{token.symbol}</h3>
                      <div className="text-xs text-retro-secondary truncate max-w-[150px]">{token.name}</div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-retro-accent font-pixel-md">{token.balance}</div>
                    </div>
                  </div>

                  <div className="flex mt-1 justify-between text-xs">
                    {token.marketCap && (
                      <span className="text-retro-secondary">
                        <span className="opacity-60">MC:</span> {formatCurrency(token.marketCap)}
                      </span>
                    )}
                    {token.volumeDay && (
                      <span className="text-retro-secondary">
                        <span className="opacity-60">VOL:</span> {formatCurrency(token.volumeDay)}
                      </span>
                    )}
                    {token.holders !== undefined && (
                      <span className="text-retro-secondary">
                        <span className="opacity-60">HOLD:</span> {token.holders}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-5">
          <p className="text-retro-secondary mb-2">No tokens found</p>
          <p className="text-xs text-retro-accent">
            {isConnected 
              ? "You don't have any token holdings yet."
              : "Connect your wallet to view your token holdings."}
          </p>
        </div>
      )}
      
      {/* Pagination */}
      {tokens.length > 0 && getTotalPages() > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <RetroButton
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="text-xs py-1 px-2"
          >
            Prev
          </RetroButton>
          
          <span className="text-xs text-retro-secondary">
            Page {currentPage} of {getTotalPages()}
          </span>
          
          <RetroButton
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === getTotalPages()}
            className="text-xs py-1 px-2"
          >
            Next
          </RetroButton>
        </div>
      )}
    </div>
  );
} 