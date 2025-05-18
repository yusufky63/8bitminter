import React, { useState, useEffect } from "react";
import Image from "next/image";
import { RetroButton } from "./ui/RetroButton";
import { searchTokenByAddress } from "../services/sdk/getCoins.js";
import { 
  fetchMostValuable, 
  fetchTopVolume,
  fetchNewCoins,
  fetchLastTraded,
  fetchWithRetry
} from "../services/sdk/getMarket.js";
import { toast } from "react-hot-toast";
import CoinDetails from "./RetroCoinDetails";

// Define custom window interface for Farcaster
declare global {
  interface Window {
    Farcaster?: {
      events: {
        on: (event: string, callback: () => void) => void;
        off: (event: string, callback: () => void) => void;
      }
    }
  }
}

interface TokenDetails {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
  creator: {
    address: string;
    profileName?: string;
  };
  imageUri?: string;
  mintPrice?: string;
  holders?: number;
  price?: string;
  volume?: string;
  marketCap?: string;
  marketCapDelta24h?: number | null;
}

// Filter type for market data
type FilterType = 'most-valuable' | 'top-volume' | 'new-tokens' | 'recently-traded';

export default function CoinExplorer() {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [tokensData, setTokensData] = useState<TokenDetails[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('top-volume');
  const [viewingDetails, setViewingDetails] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const tokensPerPage = 10;
  const totalTokens = 100;
  const [, setHasMore] = useState(false);
  const [, setPaginationCursor] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'paginated' | 'all'>('paginated');

  // Load market data based on the active filter
  useEffect(() => {
    fetchMarketData();
  }, [activeFilter]);

  // Type definitions for API responses
  interface MarketDataResponse {
    data?: {
      exploreList?: {
        edges: any[];
        pageInfo?: {
          hasNextPage?: boolean;
          endCursor?: string;
        };
      };
    };
  }

  interface TokenSearchResponse {
    success: boolean;
    data?: any;
    error?: string;
  }

  // Fetch market data based on selected filter
  const fetchMarketData = async () => {
    setIsLoading(true);
    setIsError(false);
    
    try {
      let result: MarketDataResponse;
      
      // Determine which API to call based on the active filter
      switch (activeFilter) {
        case 'most-valuable':
          result = await fetchWithRetry(fetchMostValuable, { count: totalTokens });
          break;
        case 'top-volume':
          result = await fetchWithRetry(fetchTopVolume, { count: totalTokens });
          break;
        case 'new-tokens':
          result = await fetchWithRetry(fetchNewCoins, { count: totalTokens });
          break;
        case 'recently-traded':
          result = await fetchWithRetry(fetchLastTraded, { count: totalTokens });
          break;
        default:
          result = await fetchWithRetry(fetchMostValuable, { count: totalTokens });
      }
      
      if (result && result.data?.exploreList?.edges) {
        // Process and format token data from the edges/nodes structure
        const tokens = result.data.exploreList.edges.map(edge => ({
          address: edge.node.address,
          name: edge.node.name,
          symbol: edge.node.symbol || edge.node.name,
          totalSupply: formatNumber(edge.node.totalSupply || "0"),
          creator: {
            address: edge.node.creatorAddress || "Unknown",
            profileName: edge.node.creatorProfile?.handle
          },
          imageUri: edge.node.mediaContent?.previewImage?.medium || 
                     edge.node.mediaContent?.image?.medium ||
                     null,
          price: formatCurrency(edge.node.marketCap ? (parseFloat(edge.node.marketCap) / parseFloat(edge.node.totalSupply || "1")).toString() : "0"),
          volume: formatCurrency(edge.node.volume24h),
          marketCap: formatCurrency(edge.node.marketCap),
          holders: edge.node.uniqueHolders || 0,
          marketCapDelta24h: edge.node.marketCapDelta24h ? parseFloat(edge.node.marketCapDelta24h) : null
        }));
        
        setTokensData(tokens);
        setHasMore(result.data.exploreList.pageInfo?.hasNextPage || false);
        setPaginationCursor(result.data.exploreList.pageInfo?.endCursor || null);
      }
    } catch (error) {
      console.error(`Error fetching ${activeFilter} data:`, error);
      setIsError(true);
      toast.error(`Failed to load market data. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Format large numbers for display (K, M, B, T)
  const formatNumber = (num: string): string => {
    try {
      const value = parseFloat(num);
      if (isNaN(value)) return "0";
      
      if (value >= 1e12) return (value / 1e12).toFixed(2) + 'T';
      if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
      if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
      if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
      
      return value.toFixed(2);
    } catch (e) {
      return "0";
    }
  };

  // Format currency values (ETH/USD)
  const formatCurrency = (value?: string): string => {
    if (!value) return "0";
    try {
      const num = parseFloat(value);
      if (isNaN(num)) return "0";
      
      return num.toFixed(3);
    } catch (_) {
      return "0";
    }
  };

  // Search for a specific token by address
  const searchToken = async () => {
    if (!searchQuery) {
      toast.error("Please enter a token address");
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await searchTokenByAddress(searchQuery) as TokenSearchResponse;
      
      if (result.success && result.data) {
        setTokenDetails({
          address: result.data.address,
          name: result.data.name,
          symbol: result.data.symbol,
          totalSupply: result.data.totalSupply || "0",
          creator: {
            address: result.data.creator?.address || "Unknown",
            profileName: result.data.creator?.profileName
          },
          imageUri: result.data.imageURI,
          mintPrice: result.data.mintPrice,
          holders: result.data.holders
        });

        // Reset tokens list when specific search is performed
        setTokensData([]);
      } else {
        toast.error(result.error || "Token not found");
        setTokenDetails(null);
      }
    } catch (error) {
      console.error("Error searching for token:", error);
      toast.error("Failed to search for token");
      setTokenDetails(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle back button from details view
  const handleBackFromDetails = () => {
    setViewingDetails(false);
  };

  // View token details
  const handleViewDetails = (tokenAddress?: string) => {
    const address = tokenAddress || tokenDetails?.address;
    if (!address) return;
    setViewingDetails(true);
    setSelectedTokenAddress(address);
  };

  // Change active filter
  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setTokenDetails(null); // Clear any specific token details
    setCurrentPage(1);
    setPaginationCursor(null);
  };

  // Toggle between paginated and all items view
  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'paginated' ? 'all' : 'paginated');
  };

  // Handle retry on error
  const handleRetry = () => {
    fetchMarketData();
  };

  // Get current tokens for pagination
  const getCurrentTokens = () => {
    if (displayMode === 'all') return tokensData;
    
    const startIndex = (currentPage - 1) * tokensPerPage;
    return tokensData.slice(startIndex, startIndex + tokensPerPage);
  };

  // Calculate total pages
  const totalPages = Math.ceil(tokensData.length / tokensPerPage);

  // Change page
  const changePage = (page: number) => {
    setCurrentPage(page);
  };

  // Selected token address for details view
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string | undefined>(undefined);

  // If viewing token details
  if (viewingDetails && selectedTokenAddress) {
    return <CoinDetails coinAddress={selectedTokenAddress} onBack={handleBackFromDetails} />;
  }

  // Add a helper function to format 24h change
  const format24hChange = (value: number | null | undefined): { text: string; color: string } => {
    if (value === null || value === undefined) return { text: "0%", color: "text-retro-secondary" };
    
    // Format as percentage with sign
    const sign = value >= 0 ? "+" : "";
    const text = `${sign}${value.toFixed(2)}%`;
    
    // Determine color based on value
    const color = value > 0 ? "text-retro-success" : value < 0 ? "text-retro-error" : "text-retro-secondary";
    
    return { text, color };
  };

  return (
    <div className="retro-container p-2">
      <h2 className="retro-header text-sm mb-3">Explore Tokens</h2>
      
      {/* Search bar */}
      <div className="mb-4">
        <div className="flex gap-1">
          <input
            type="text"
            className="retro-input w-full text-xs py-1"
            placeholder="0x..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <RetroButton 
            onClick={searchToken}
            isLoading={isLoading && searchQuery.length > 0}
            className="text-xs py-1"
          >
            Search
          </RetroButton>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="mb-3">
        <div className="grid grid-cols-2 gap-1">
        
          <RetroButton 
            className={`text-[8px] py-0.5 px-1 ${activeFilter === 'top-volume' ? 'bg-retro-primary' : 'bg-retro-dark border border-retro-primary'}`}
            onClick={() => handleFilterChange('top-volume')}
          >
            Volume
          </RetroButton>
          <RetroButton 
            className={`text-[8px] py-0.5 px-1 ${activeFilter === 'new-tokens' ? 'bg-retro-primary' : 'bg-retro-dark border border-retro-primary'}`}
            onClick={() => handleFilterChange('new-tokens')}
          >
            New
          </RetroButton>
            <RetroButton 
            className={`text-[8px] py-0.5 px-1 ${activeFilter === 'most-valuable' ? 'bg-retro-primary' : 'bg-retro-dark border border-retro-primary'}`}
            onClick={() => handleFilterChange('most-valuable')}
          >
            Valuable
          </RetroButton>
          <RetroButton 
            className={`text-[8px] py-0.5 px-1 ${activeFilter === 'recently-traded' ? 'bg-retro-primary' : 'bg-retro-dark border border-retro-primary'}`}
            onClick={() => handleFilterChange('recently-traded')}
          >
            Recent
          </RetroButton>
        </div>
      </div>

      {/* Display mode toggle - Paginated vs All */}
      <div className="flex justify-end mb-2">
        <button
          onClick={toggleDisplayMode}
          className="text-xs text-retro-primary hover:text-retro-accent transition-colors"
        >
          {displayMode === 'paginated' ? 'Show All (100)' : 'Show Pages (10)'}
        </button>
      </div>

      {/* Loading state */}
      {isLoading && !tokenDetails && (
        <div className="flex justify-center my-4">
          <div className="retro-loading">
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
      )}

      {/* Error state with retry button */}
      {isError && !isLoading && (
        <div className="text-center my-4">
          <p className="text-retro-error mb-2">Failed to load market data</p>
          <RetroButton onClick={handleRetry} className="text-xs">
            Retry
          </RetroButton>
        </div>
      )}

      {/* Individual token details (from search) */}
      {!isLoading && tokenDetails && (
        <div className="retro-card p-2 mb-4">
          <div className="flex items-start gap-2 mb-3">
            {tokenDetails.imageUri ? (
              <Image 
                src={tokenDetails.imageUri} 
                alt={tokenDetails.name} 
                width={56}
                height={56}
                className="w-14 h-14 rounded-md pixelated"
                unoptimized
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.style.display = "none";
                  const parent = target.parentNode;
                  if (parent) {
                    const svgPlaceholder = document.createElement("div");
                    svgPlaceholder.className = "w-14 h-14 bg-retro-primary/5 flex items-center justify-center rounded-md";
                    svgPlaceholder.innerHTML = `<span class="text-retro-primary text-lg font-bold">?</span>`;
                    parent.appendChild(svgPlaceholder);
                  }
                }}
              />
            ) : (
              <div className="w-14 h-14 bg-retro-primary/5 flex items-center justify-center rounded-md">
                <span className="text-retro-primary text-lg font-bold">?</span>
              </div>
            )}
            
            <div className="flex-1">
              <h3 className="text-sm font-bold text-retro-primary mb-0.5">{tokenDetails.name}</h3>
              <div className="text-xs text-retro-accent mb-0.5">{tokenDetails.symbol}</div>
              <div className="text-xs text-retro-secondary truncate mb-1">
                {tokenDetails.address.substring(0, 8)}...{tokenDetails.address.substring(tokenDetails.address.length - 6)}
              </div>
              
              <div className="grid grid-cols-2 gap-1 text-xs">
                {tokenDetails.creator?.profileName && (
                  <div>
                    <span className="text-retro-secondary">Creator:</span>{" "}
                    <span className="text-retro-accent">
                      {tokenDetails.creator.profileName || tokenDetails.creator.address.substring(0, 6) + '...'}
                    </span>
                  </div>
                )}
                {tokenDetails.totalSupply && (
                  <div>
                    <span className="text-retro-secondary">Supply:</span>{" "}
                    <span className="text-retro-accent">{parseFloat(tokenDetails.totalSupply).toFixed(2)}</span>
                  </div>
                )}
                {tokenDetails.holders && (
                  <div>
                    <span className="text-retro-secondary">Holders:</span>{" "}
                    <span className="text-retro-accent">{tokenDetails.holders}</span>
                  </div>
                )}
                {tokenDetails.mintPrice && (
                  <div>
                    <span className="text-retro-secondary">Mint Price:</span>{" "}
                    <span className="text-retro-accent">{tokenDetails.mintPrice}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-2 flex justify-center">
            <RetroButton 
              onClick={() => handleViewDetails()}
              variant="default"
              fullWidth
              className="text-xs py-1"
            >
              View {tokenDetails.symbol} Details
            </RetroButton>
          </div>
        </div>
      )}

      {/* Market data tokens list */}
      {!isLoading && !tokenDetails && tokensData.length > 0 && (
        <div className="space-y-2 mb-3">
          {getCurrentTokens().map((token, index) => (
            <div key={token.address} className="retro-card p-2 hover:border-retro-accent transition-colors cursor-pointer" onClick={() => handleViewDetails(token.address)}>
              <div className="flex items-center gap-2">
                {token.imageUri ? (
                  <Image 
                    src={token.imageUri} 
                    alt={token.name}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-md pixelated"
                    unoptimized
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.style.display = "none";
                      const parent = target.parentNode;
                      if (parent) {
                        const placeholder = document.createElement("div");
                        placeholder.className = "w-10 h-10 bg-retro-primary/5 flex items-center justify-center rounded-md";
                        placeholder.innerHTML = `<span class="text-retro-primary text-lg font-bold">${token.symbol.charAt(0)}</span>`;
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 bg-retro-primary/5 flex items-center justify-center rounded-md">
                    <span className="text-retro-primary text-lg font-bold">{token.symbol.charAt(0)}</span>
                  </div>
                )}
                
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-semibold text-retro-primary">{token.symbol.length > 10 ? token.symbol.substring(0, 8) + '...' : token.symbol}</h3>
                      <div className="text-xs text-retro-secondary truncate max-w-[150px]">{token.name}</div>
                    </div>
                    
                    <div className="text-right">
                      {token.marketCapDelta24h !== null && (
                        <div className={`text-[10px] ${format24hChange(token.marketCapDelta24h).color}`}>
                          {format24hChange(token.marketCapDelta24h).text}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex mt-1 justify-between text-[10px]">
                    {token.marketCap && (
                      <span className="text-retro-secondary">
                        <span className="opacity-60">MC:</span> {token.marketCap}$
                      </span>
                    )}
                    {token.volume && (
                      <span className="text-retro-secondary">
                        <span className="opacity-60">VOL:</span> {token.volume}$
                      </span>
                    )}
                    {token.holders !== undefined && (
                      <span className="text-retro-secondary">
                        <span className="opacity-60">HOLD:</span> {formatNumber(token.holders.toString())}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && tokensData.length === 0 && !tokenDetails && (
        <div className="text-center py-4">
          <p className="text-retro-secondary text-sm mb-2">No tokens found</p>
          <RetroButton onClick={handleRetry} className="text-xs">
            Load Market Data
          </RetroButton>
        </div>
      )}

      {/* Pagination */}
      {displayMode === 'paginated' && tokensData.length > tokensPerPage && !tokenDetails && (
        <div className="flex justify-center items-center gap-1 mt-4">
          <RetroButton
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1}
            className="text-xs py-1 px-2"
          >
            Prev
          </RetroButton>
          
          <span className="text-xs text-retro-secondary mx-2">
            Page {currentPage} of {totalPages}
          </span>
          
          <RetroButton
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="text-xs py-1 px-2"
          >
            Next
          </RetroButton>
        </div>
      )}
    </div>
  );
} 