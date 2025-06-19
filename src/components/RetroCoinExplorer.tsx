import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { RetroButton } from "./ui/RetroButton";
import { RetroInput } from "./ui/RetroInput";
import { searchTokenByAddress } from "../services/sdk/getCoins.js";
import { getCoinDetails, fetchCoinDetails } from "../services/sdk/getCoins.js";
import { getCoins } from "@zoralabs/coins-sdk";
import { CoinService } from "../services/coinService";
import { type Coin } from "../lib/supabase";
import {
  fetchMostValuable,
  fetchTopVolume,
  fetchNewCoins,
  fetchLastTraded,
  fetchTopGainers,
  fetchLastTradedUnique,
  fetchWithRetry,
} from "../services/sdk/getMarket.js";
import CoinDetails from "./RetroCoinDetails";
import { CoinCard } from "./CoinCard";
import { resolveImageUrl, loadImageWithFallback } from "../utils/ipfs";
import {
  Home,
  Zap,
  Globe,
  BarChart3,
  Users,
  Settings,
  ChevronDown,
  ArrowLeft,
  Search,
} from "lucide-react";

// Declare global types for Farcaster
declare global {
  interface Window {
    Farcaster?: {
      events: {
        on: (event: string, callback: () => void) => void;
        off: (event: string, callback: () => void) => void;
      };
    };
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

interface ZoraCoin {
  id: string;
  name: string;
  symbol: string;
  description?: string;
  contract_address: string;
  image_url?: string;
  category: string;
  creator_address: string;
  chain_id: number;
  platform: "local" | "zora";
}

// Filter type for market data
type FilterType =
  | "top-volume"
  | "new-tokens"
  | "most-valuable"
  | "top-gainers"
  | "last-traded";
type PlatformType = "local" | "all" | "market";

interface RetroCoinExplorerProps {
  initialFilter?: FilterType;
  initialPlatform?: PlatformType;
}

export default function RetroCoinExplorer({
  initialFilter = "top-volume",
  initialPlatform = "local",
}: RetroCoinExplorerProps) {
  // Platform and coin states
  const [activePlatform, setActivePlatform] =
    useState<PlatformType>(initialPlatform);
  const [localCoins, setLocalCoins] = useState<Coin[]>([]);
  const [stats, setStats] = useState<any>({
    totalCoins: 0,
    totalCreators: 0,
    categoryCounts: {},
  });

  // Market data states
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [tokensData, setTokensData] = useState<TokenDetails[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter);
  const [viewingDetails, setViewingDetails] = useState(false);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>("");

  // UI states - unified search
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Pagination for market data
  const [currentPage, setCurrentPage] = useState(1);
  const tokensPerPage = 12;
  const totalTokens = 50;
  const [hasMore, setHasMore] = useState(false);
  const [paginationCursor, setPaginationCursor] = useState<string | null>(null);

  // Pagination for local coins
  const [localCurrentPage, setLocalCurrentPage] = useState(1);
  const localCoinsPerPage = 5;
  const [localCoinsWithData, setLocalCoinsWithData] = useState<TokenDetails[]>(
    []
  );
  const [localCoinsLoading, setLocalCoinsLoading] = useState(false);

  const categories = ["All", "DeFi", "Gaming", "NFT", "Meme", "Utility"];

  // Load data based on platform
  useEffect(() => {
    if (activePlatform === "market") {
      fetchMarketData();
    } else {
      loadLocalCoins();
      loadStats();
    }
  }, [activePlatform, activeFilter]);

  // Load local coins
  const loadLocalCoins = async () => {
    setLoading(true);
    try {
      const coins = await CoinService.getCoins();
      setLocalCoins(coins);
      // Load market data for local coins
      await loadLocalCoinsMarketData(coins);
    } catch (error) {
      console.error("Error loading local coins:", error);
      toast.error("Failed to load local coins");
    } finally {
      setLoading(false);
    }
  };

  // Load market data for local coins using batch fetch
  const loadLocalCoinsMarketData = async (coins: Coin[]) => {
    setLocalCoinsLoading(true);
    try {
      if (coins.length === 0) {
        setLocalCoinsWithData([]);
        return;
      }

      console.log(
        `🔄 Fetching market data for ${coins.length} coins using batch request...`
      );

      // Prepare coins for batch request
      const coinsForBatch = coins.map((coin) => ({
        collectionAddress: coin.contract_address,
        chainId: coin.chain_id,
      }));

      // Fetch all coins data in one request
      const response = await getCoins({ coins: coinsForBatch });

      console.log("📊 Batch API response:", response);

      const coinsWithMarketData: TokenDetails[] = [];

      if (response?.data?.zora20Tokens) {
        // Create a map for quick lookup
        const marketDataMap = new Map();
        response.data.zora20Tokens.forEach((token: any) => {
          marketDataMap.set(token.address.toLowerCase(), token);
        });

        // Process each coin with its market data
        coins.forEach((coin) => {
          const marketData = marketDataMap.get(
            coin.contract_address.toLowerCase()
          );

          if (marketData) {
            console.log(`✅ Processing market data for ${coin.symbol}:`, {
              totalSupply: marketData.totalSupply,
              uniqueHolders: marketData.uniqueHolders,
              volume24h: marketData.volume24h,
              marketCap: marketData.marketCap,
              marketCapDelta24h: marketData.marketCapDelta24h,
            });

            coinsWithMarketData.push({
              address: coin.contract_address,
              name: marketData.name || coin.name,
              symbol: marketData.symbol || coin.symbol,
              totalSupply: (marketData.totalSupply || "0").toString(),
              creator: {
                address: coin.creator_address,
                profileName: marketData.creatorProfile?.handle || undefined,
              },
              imageUri: resolveImageUrl(
                marketData.mediaContent?.previewImage?.medium ||
                  marketData.mediaContent?.previewImage?.small ||
                  coin.image_url ||
                  ""
              ),
              mintPrice: "0",
              holders: Number(marketData.uniqueHolders || 0),
              price: "0",
              volume: (
                marketData.volume24h ||
                marketData.totalVolume ||
                "0"
              ).toString(),
              marketCap: (marketData.marketCap || "0").toString(),
              marketCapDelta24h: parseFloat(
                (marketData.marketCapDelta24h || "0").toString()
              ),
            });
          } else {
            console.warn(
              `⚠️ No market data found for ${coin.symbol} (${coin.contract_address})`
            );
            // Add basic data if no market data found
            coinsWithMarketData.push({
              address: coin.contract_address,
              name: coin.name,
              symbol: coin.symbol,
              totalSupply: "0",
              creator: {
                address: coin.creator_address,
                profileName: undefined,
              },
              imageUri: resolveImageUrl(coin.image_url || ""),
              mintPrice: "0",
              holders: 0,
              price: "0",
              volume: "0",
              marketCap: "0",
              marketCapDelta24h: 0,
            });
          }
        });
      } else {
        console.error("❌ Invalid response format from batch API");
        // Fallback: add basic data for all coins
        coins.forEach((coin) => {
          coinsWithMarketData.push({
            address: coin.contract_address,
            name: coin.name,
            symbol: coin.symbol,
            totalSupply: "0",
            creator: {
              address: coin.creator_address,
              profileName: undefined,
            },
            imageUri: resolveImageUrl(coin.image_url || ""),
            mintPrice: "0",
            holders: 0,
            price: "0",
            volume: "0",
            marketCap: "0",
            marketCapDelta24h: 0,
          });
        });
      }

      console.log(
        `✅ Successfully processed ${coinsWithMarketData.length} coins with market data`
      );
      setLocalCoinsWithData(coinsWithMarketData);
    } catch (error) {
      console.error("❌ Error loading local coins market data:", error);

      // Fallback: add basic data for all coins
      const fallbackData: TokenDetails[] = coins.map((coin) => ({
        address: coin.contract_address,
        name: coin.name,
        symbol: coin.symbol,
        totalSupply: "0",
        creator: {
          address: coin.creator_address,
          profileName: undefined,
        },
        imageUri: resolveImageUrl(coin.image_url || ""),
        mintPrice: "0",
        holders: 0,
        price: "0",
        volume: "0",
        marketCap: "0",
        marketCapDelta24h: 0,
      }));

      setLocalCoinsWithData(fallbackData);
    } finally {
      setLocalCoinsLoading(false);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const statsData = await CoinService.getCoinStats();
      setStats(statsData);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setLocalCurrentPage(1); // Reset pagination when searching
    setCurrentPage(1); // Reset market data pagination too
    setTokenDetails(null); // Clear individual token details when searching
  };

  // Get display coins based on platform
  const getDisplayCoins = () => {
    if (activePlatform === "market") {
      return []; // Market data is handled separately
    }

    let coinsToShow: Coin[] = [...localCoins]; // Show all our created coins

    // Apply search filter only
    if (searchTerm) {
      coinsToShow = coinsToShow.filter(
        (coin) =>
          coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          coin.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (coin.description &&
            coin.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return coinsToShow;
  };

  // Market data functions
  const fetchMarketData = async () => {
    setIsLoading(true);
    setIsError(false);

    try {
      let fetchFunction;
      switch (activeFilter) {
        case "top-volume":
          fetchFunction = fetchTopVolume;
          break;
        case "new-tokens":
          fetchFunction = fetchNewCoins;
          break;
        case "most-valuable":
          fetchFunction = fetchMostValuable;
          break;
        case "top-gainers":
          fetchFunction = fetchTopGainers;
          break;
        case "last-traded":
          fetchFunction = fetchLastTraded;
          break;
        default:
          fetchFunction = fetchTopVolume;
      }

      console.log("🔄 Fetching market data with filter:", activeFilter);
      console.log("🔄 Using function:", fetchFunction.name);

      const data = (await fetchFunction({
        count: 100, // Increased from 50 to get more data
        after: paginationCursor || "",
        chainId: 8453,
      })) as any;

      // Handle API response format: {exploreList: {edges: [{node: {...}}]}}
      let processedTokens: TokenDetails[] = [];

      if (data && data.exploreList && data.exploreList.edges) {
        console.log("✅ Found exploreList.edges, processing...");
        console.log("📊 Edges length:", data.exploreList.edges.length);
        console.log("📊 First edge sample:", data.exploreList.edges[0]);

        processedTokens = data.exploreList.edges.map(
          (edge: any, index: number) => {
            const node = edge.node;
            console.log(`📊 Processing token ${index + 1}:`, {
              address: node.address,
              symbol: node.symbol,
              description: node.description,
              name: node.name,
            });

            return {
              address: node.address,
              name:
                node.description || node.symbol || node.name || "Unknown Token",
              symbol: node.symbol || "UNK",
              totalSupply: node.totalSupply || "0",
              creator: {
                address: node.creatorAddress || "Unknown",
                profileName: node.creatorProfile?.handle || null,
              },
              imageUri: resolveImageUrl(
                node.mediaContent?.previewImage?.medium ||
                  node.mediaContent?.previewImage?.url ||
                  node.mediaContent?.originalUri ||
                  ""
              ),
              mintPrice: "0",
              holders: node.uniqueHolders || 0,
              price: "0",
              volume: node.volume24h || "0",
              marketCap: node.marketCap || "0",
              marketCapDelta24h: parseFloat(node.marketCapDelta24h || "0"),
            };
          }
        );

        console.log("✅ Processed tokens array:", processedTokens);

        // Update pagination cursor
        const pageInfo = data.exploreList.pageInfo;
        if (pageInfo) {
          setHasMore(pageInfo.hasNextPage || false);
          setPaginationCursor(pageInfo.endCursor || null);
          console.log("📊 Pagination info:", pageInfo);
        }
      } else if (
        data &&
        data.data &&
        data.data.exploreList &&
        data.data.exploreList.edges
      ) {
        console.log("✅ Found data.exploreList.edges format, processing...");
        const edges = data.data.exploreList.edges;
        console.log("📊 Edges length:", edges.length);

        processedTokens = edges.map((edge: any, index: number) => {
          const node = edge.node;
          console.log(`📊 Processing token ${index + 1}:`, {
            address: node.address,
            symbol: node.symbol,
            description: node.description,
          });

          return {
            address: node.address,
            name:
              node.description || node.symbol || node.name || "Unknown Token",
            symbol: node.symbol || "UNK",
            totalSupply: node.totalSupply || "0",
            creator: {
              address: node.creatorAddress || "Unknown",
              profileName: node.creatorProfile?.handle || null,
            },
            imageUri: resolveImageUrl(
              node.mediaContent?.previewImage?.medium ||
                node.mediaContent?.previewImage?.url ||
                node.mediaContent?.originalUri ||
                ""
            ),
            mintPrice: "0",
            holders: node.uniqueHolders || 0,
            price: "0",
            volume: node.volume24h || "0",
            marketCap: node.marketCap || "0",
            marketCapDelta24h: parseFloat(node.marketCapDelta24h || "0"),
          };
        });
      } else if (Array.isArray(data)) {
        processedTokens = data;
      } else if (data && data.data && Array.isArray(data.data)) {
        processedTokens = data.data;
      } else if (data && data.tokens && Array.isArray(data.tokens)) {
        processedTokens = data.tokens;
      } else {
        processedTokens = [];
      }

      setTokensData(processedTokens);
      setTokenDetails(null);
    } catch (error) {
      console.error("❌ Error fetching market data:", error);
      console.error("❌ Error details:", error);
      setIsError(true);
      toast.error("Failed to load market data");
    } finally {
      setIsLoading(false);
    }
  };

  // Unified search function for both platforms
  const performSearch = async () => {
    if (!searchTerm || searchTerm.length < 2) {
      toast.error("Please enter at least 2 characters to search");
      return;
    }

    if (activePlatform === "market") {
      // Market platform search
      setIsLoading(true);
      setIsError(false);
      setTokenDetails(null);

      try {
        // If it looks like an address, search by address
        if (searchTerm.startsWith("0x") && searchTerm.length >= 10) {
          const result = (await searchTokenByAddress(searchTerm)) as any;
          if (result && result.data) {
            const tokenData = result.data as TokenDetails;
            setTokenDetails(tokenData);
            setTokensData([]);
            toast.success(`Found token: ${tokenData.symbol || "Unknown"}`);
          } else {
            toast.error("Token not found or no data available");
            setIsError(true);
          }
        } else {
          // Otherwise filter current market data and reload if needed
          setTokenDetails(null);
          if (tokensData.length === 0) {
            await fetchMarketData();
          }
          const filteredResults = tokensData.filter(
            (token) =>
              token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
              token.address.toLowerCase().includes(searchTerm.toLowerCase())
          );
          if (filteredResults.length > 0) {
            toast.success(`Found ${filteredResults.length} token(s)`);
          } else {
            toast(`No tokens found matching your search`, { duration: 3000 });
          }
        }
      } catch (error) {
        console.error("Error searching token:", error);
        toast.error("Failed to search token. Please try again.");
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Local platform search
      const filteredResults = localCoinsWithData.filter(
        (coin) =>
          coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          coin.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          coin.address.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (filteredResults.length > 0) {
        toast.success(
          `Found ${filteredResults.length} coin(s) in your collection`
        );
      } else {
        toast(`No coins found in your collection matching the search`, {
          duration: 3000,
        });
      }

      // Reset to first page when searching
      setLocalCurrentPage(1);
    }
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handleRetry = () => {
    fetchMarketData();
  };

  const handleViewDetails = (address?: string) => {
    const addressToUse = address || tokenDetails?.address;
    if (addressToUse) {
      setSelectedTokenAddress(addressToUse);
      setViewingDetails(true);
    }
  };

  const handleBackFromDetails = () => {
    setViewingDetails(false);
    setSelectedTokenAddress("");
  };

  // Handle viewing coin details
  const handleViewCoinDetails = (contractAddress: string) => {
    setSelectedTokenAddress(contractAddress);
    setViewingDetails(true);
  };

  // Pagination functions for market data
  const totalPages = Math.ceil(tokensData.length / tokensPerPage);

  const getCurrentTokens = () => {
    const startIndex = (currentPage - 1) * tokensPerPage;
    return tokensData.slice(startIndex, startIndex + tokensPerPage);
  };

  const changePage = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Pagination functions for local coins
  const localTotalPages = Math.ceil(
    localCoinsWithData.length / localCoinsPerPage
  );

  const getCurrentLocalCoins = () => {
    const startIndex = (localCurrentPage - 1) * localCoinsPerPage;
    return localCoinsWithData.slice(startIndex, startIndex + localCoinsPerPage);
  };

  const changeLocalPage = (newPage: number) => {
    setLocalCurrentPage(newPage);
  };

  // Format functions
  const formatNumber = (num: string) => {
    const n = parseFloat(num);
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const format24hChange = (change: number | null) => {
    if (change === null || change === undefined)
      return { text: "N/A", color: "text-retro-secondary" };

    const isPositive = change > 0;
    const text = `${isPositive ? "+" : ""}${change.toFixed(2)}%`;
    const color = isPositive ? "text-green-400" : "text-red-400";

    return { text, color };
  };

  // If viewing token details
  if (viewingDetails && selectedTokenAddress) {
    return (
      <CoinDetails
        coinAddress={selectedTokenAddress}
        onBack={handleBackFromDetails}
      />
    );
  }

  const displayCoins = getDisplayCoins();

  return (
    <div className="min-h-screen bg-retro-darker">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-retro-primary/20 to-retro-primary/5 border-b border-retro-primary">
        <div className="max-w-7xl mx-auto px-2 py-2">
          {/* Platform Tabs */}
          <div className="flex justify-center gap-3 mb-2 w-full">
            <button
              onClick={() => setActivePlatform("local")}
              className={`px-4 py-1.5 border-2 transition-all duration-200 text-sm font-medium flex items-center gap-2 w-full ${
                activePlatform === "local"
                  ? "bg-retro-primary text-retro-darker border-retro-primary shadow-lg"
                  : "bg-transparent text-retro-accent border-retro-primary hover:bg-retro-primary/20"
              }`}
            >
              <Home size={18} />
              <span>Our Coins</span>
              <span className="text-xs bg-retro-darker/30 px-2 py-1 rounded">
                {localCoins.length}
              </span>
            </button>

            <button
              onClick={() => setActivePlatform("market")}
              className={`px-4 py-1.5 border-2 transition-all duration-200 text-sm font-medium flex items-center gap-2 w-full ${
                activePlatform === "market"
                  ? "bg-retro-primary text-retro-darker border-retro-primary shadow-lg"
                  : "bg-transparent text-retro-accent border-retro-primary hover:bg-retro-primary/20"
              }`}
            >
              <BarChart3 size={18} />
              <span>All Coins</span>
            </button>
          </div>

          {/* Search Section */}
          <div className="flex gap-2 my-4">
            <div className="flex-1 relative">
              <input
                type="text"
                className="retro-input w-full text-xs py-2 pl-8 pr-3 border-2 border-retro-primary bg-black/60 text-retro-accent placeholder-retro-secondary/60"
                placeholder="Search by name, symbol or address..."
                value={searchTerm}
                onChange={handleSearch}
              />
             
            </div>
            <RetroButton
              onClick={performSearch}
              isLoading={isLoading && searchTerm.length > 0}
              className="flex items-center text-xs py-2 px-3 bg-retro-primary hover:bg-retro-primary/80 border-retro-primary transition-all duration-200"
            >
              <Search size={14} className="mr-1" />
            
            </RetroButton>
          </div>

          {/* Stats for local platform */}
          {activePlatform === "local" && (
            <div className="flex justify-center gap-6 mt-4 text-sm text-retro-secondary">
              <span className="flex items-center gap-2">
                <BarChart3 size={14} />
                {stats.totalCoins} Total Coins
              </span>
              <span className="flex items-center gap-2">
                <Users size={14} />
                {stats.totalCreators} Creators
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Market Data Section */}
      {activePlatform === "market" && (
        <div className="max-w-7xl mx-auto  py-4 w-full">
          {/* Filter Select */}
          <div className="mb-6 flex justify-center ">
            <select
              value={activeFilter}
              onChange={(e) => handleFilterChange(e.target.value as FilterType)}
              className="bg-retro-darker border-2 border-retro-primary text-retro-accent px-4 py-2 text-sm font-medium focus:outline-none focus:border-retro-accent w-full"
            >
              <option value="top-volume"> Top Volume</option>
              <option value="new-tokens"> New Tokens</option>
              <option value="most-valuable"> Most Valuable</option>
              <option value="top-gainers"> Top Gainers</option>
              <option value="last-traded"> Recently Traded</option>
            </select>
          </div>

          {/* Market Data Results */}
          {renderMarketDataSection()}
        </div>
      )}

      {/* Regular Coins Section */}
      {activePlatform !== "market" && (
        <div className="max-w-7xl mx-auto  py-4">
          {renderCoinsSection()}
        </div>
      )}
    </div>
  );

  // Render market data section
  function renderMarketDataSection() {
    return (
      <>
        {/* Results info */}

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

        {/* Error state */}
        {isError && !isLoading && (
          <div className="text-center my-4">
            <p className="text-retro-error mb-2">Failed to load market data</p>
            <RetroButton onClick={handleRetry} className="text-xs">
              Retry
            </RetroButton>
          </div>
        )}

        {/* Individual token details */}
        {!isLoading && tokenDetails && (
          <div className="retro-card p-2 mb-4">
            <div className="flex items-start gap-2 mb-3">
              <TokenImage
                imageUrl={tokenDetails.imageUri}
                name={tokenDetails.name}
                size="large"
              />

              <div className="flex-1">
                <h3 className="text-sm font-bold text-retro-primary mb-0.5">
                  {tokenDetails.name}
                </h3>
                <div className="text-xs text-retro-accent mb-0.5">
                  {tokenDetails.symbol}
                </div>
                <div className="text-xs text-retro-secondary truncate mb-1">
                  {tokenDetails.address.substring(0, 8)}...
                  {tokenDetails.address.substring(
                    tokenDetails.address.length - 6
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1 text-xs">
                  {tokenDetails.creator?.profileName && (
                    <div>
                      <span className="text-retro-secondary">Creator:</span>{" "}
                      <span className="text-retro-accent">
                        {tokenDetails.creator.profileName ||
                          tokenDetails.creator.address.substring(0, 6) + "..."}
                      </span>
                    </div>
                  )}
                  {tokenDetails.totalSupply && (
                    <div>
                      <span className="text-retro-secondary">Supply:</span>{" "}
                      <span className="text-retro-accent">
                        {parseFloat(tokenDetails.totalSupply).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {tokenDetails.holders && (
                    <div>
                      <span className="text-retro-secondary">Holders:</span>{" "}
                      <span className="text-retro-accent">
                        {tokenDetails.holders}
                      </span>
                    </div>
                  )}
                  {tokenDetails.mintPrice && (
                    <div>
                      <span className="text-retro-secondary">Mint Price:</span>{" "}
                      <span className="text-retro-accent">
                        {tokenDetails.mintPrice}
                      </span>
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
          <div className="space-y-3 mb-6">
            {getCurrentTokens()
              .filter(
                (token) =>
                  !searchTerm ||
                  token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  token.symbol
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()) ||
                  token.address.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((token, index) => (
                <div
                  key={token.address || `token-${index}`}
                  className="bg-retro-darker border-2 border-retro-primary p-3 hover:border-retro-accent transition-all duration-200 cursor-pointer hover:shadow-[0_0_10px_rgba(255,107,53,0.2)]"
                  onClick={() => handleViewDetails(token.address)}
                >
                  <div className="flex items-center gap-3">
                    <TokenImage
                      imageUrl={token.imageUri}
                      name={token.name || "Unknown"}
                      size="large"
                    />

                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-sm font-bold text-retro-primary mb-1">
                            {token.symbol && token.symbol.length > 10
                              ? token.symbol.substring(0, 8) + "..."
                              : token.symbol || "UNK"}
                          </h3>
                        </div>

                        <div className="text-right">
                          {token.marketCapDelta24h !== null &&
                            token.marketCapDelta24h !== undefined && (
                              <div
                                className={`text-xs font-medium ${
                                  format24hChange(
                                    token.marketCapDelta24h || null
                                  ).color
                                }`}
                              >
                                {
                                  format24hChange(
                                    token.marketCapDelta24h || null
                                  ).text
                                }
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-xs">
                        {token.marketCap && (
                          <div className="flex items-center gap-1">
                            <span className="text-retro-secondary">MC:</span>
                            <span className="text-retro-accent font-medium">
                              ${formatNumber(token.marketCap)}
                            </span>
                          </div>
                        )}
                        {token.volume && (
                          <div className="flex items-center gap-1">
                            <span className="text-retro-secondary">VOL:</span>
                            <span className="text-retro-accent font-medium">
                              ${formatNumber(token.volume)}
                            </span>
                          </div>
                        )}
                        {token.holders !== undefined && (
                          <div className="flex items-center gap-1">
                            <span className="text-retro-secondary">H:</span>
                            <span className="text-retro-accent font-medium">
                              {formatNumber(token.holders.toString())}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
        {/* Debug info for development */}
    

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
        {tokensData.length > tokensPerPage && !tokenDetails && (
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
      </>
    );
  }

  // Render coins section
  function renderCoinsSection() {
    if (loading || localCoinsLoading) {
      return (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-retro-primary mx-auto mb-4"></div>
          <div className="text-retro-accent text-lg">
            {loading ? "Loading coins..." : "Loading market data..."}
          </div>
        </div>
      );
    }

    // Apply search filter to local coins
    let filteredLocalCoins = [...localCoinsWithData];
    if (searchTerm) {
      filteredLocalCoins = localCoinsWithData.filter(
        (coin) =>
          coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          coin.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          coin.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filteredLocalCoins.length === 0) {
      return (
        <div className="text-center py-16">
          <div className="text-8xl mb-6">🪙</div>
          <div className="text-retro-primary text-xl font-bold mb-4">
            {searchTerm ? "No coins found" : "No coins created yet"}
          </div>
          <div className="text-retro-secondary text-lg mb-6">
            {searchTerm
              ? "Try adjusting your search terms"
              : "Be the first to create a coin on our platform!"}
          </div>
          {!searchTerm && (
            <Link
              href="/"
              className="inline-block bg-retro-primary text-retro-darker px-6 py-3 font-medium hover:bg-retro-accent transition-colors duration-200"
            >
              Create Your First Coin
            </Link>
          )}
        </div>
      );
    }

    // Get paginated filtered coins
    const localFilteredTotalPages = Math.ceil(
      filteredLocalCoins.length / localCoinsPerPage
    );
    const startIndex = (localCurrentPage - 1) * localCoinsPerPage;
    const currentLocalCoins = filteredLocalCoins.slice(
      startIndex,
      startIndex + localCoinsPerPage
    );

    return (
      <div className="space-y-6">
        {/* Results info */}

        {/* Coins list */}
        <div className="space-y-3 mb-2">
          {currentLocalCoins.map((token) => (
            <div
              key={token.address}
              className="bg-retro-darker border-2 border-retro-primary p-3 hover:border-retro-accent transition-all duration-200 cursor-pointer hover:shadow-[0_0_10px_rgba(255,107,53,0.2)]"
              onClick={() => handleViewDetails(token.address)}
            >
              <div className="flex items-center gap-3">
                <TokenImage
                  imageUrl={token.imageUri}
                  name={token.name || "Unknown"}
                  size="large"
                />

                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-retro-primary mb-1">
                        {token.symbol && token.symbol.length > 10
                          ? token.symbol.substring(0, 8) + "..."
                          : token.symbol || "UNK"}
                      </h3>
                    </div>

                    <div className="text-right">
                      {token.marketCapDelta24h !== null &&
                        token.marketCapDelta24h !== undefined && (
                          <div
                            className={`text-xs font-medium ${
                              format24hChange(token.marketCapDelta24h || null)
                                .color
                            }`}
                          >
                            {
                              format24hChange(token.marketCapDelta24h || null)
                                .text
                            }
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    {token.marketCap && (
                      <div className="flex items-center gap-1">
                        <span className="text-retro-secondary">MC:</span>
                        <span className="text-retro-accent font-medium">
                          ${formatNumber(token.marketCap)}
                        </span>
                      </div>
                    )}
                    {token.volume && (
                      <div className="flex items-center gap-1">
                        <span className="text-retro-secondary">VOL:</span>
                        <span className="text-retro-accent font-medium">
                          ${formatNumber(token.volume)}
                        </span>
                      </div>
                    )}
                    {token.holders !== undefined && (
                      <div className="flex items-center gap-1">
                        <span className="text-retro-secondary">H:</span>
                        <span className="text-retro-accent font-medium">
                          {formatNumber(token.holders.toString())}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {filteredLocalCoins.length > localCoinsPerPage && (
          <div className="flex justify-center items-center gap-1 mt-4">
            <RetroButton
              onClick={() => changeLocalPage(localCurrentPage - 1)}
              disabled={localCurrentPage === 1}
              className="text-xs py-1 px-2"
            >
              Prev
            </RetroButton>

            <span className="text-xs text-retro-secondary mx-2">
              Page {localCurrentPage} of {localFilteredTotalPages}
            </span>

            <RetroButton
              onClick={() => changeLocalPage(localCurrentPage + 1)}
              disabled={localCurrentPage === localFilteredTotalPages}
              className="text-xs py-1 px-2"
            >
              Next
            </RetroButton>
          </div>
        )}
      </div>
    );
  }
}

// Enhanced Token Image Component with fallback support
function TokenImage({
  imageUrl,
  name,
  size = "small",
}: {
  imageUrl?: string;
  name: string;
  size?: "small" | "large";
}) {
  const [currentSrc, setCurrentSrc] = useState(imageUrl || "");
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!imageUrl);

  const dimensions =
    size === "large"
      ? { width: 56, height: 56, className: "w-14 h-14" }
      : { width: 40, height: 40, className: "w-10 h-10" };

  useEffect(() => {
    if (imageUrl) {
      setCurrentSrc(imageUrl);
      setHasError(false);
      setIsLoading(true);
    }
  }, [imageUrl]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (!currentSrc || hasError) {
    return (
      <div
        className={`${dimensions.className} bg-retro-primary/5 flex items-center justify-center rounded-md`}
      >
        <span className="text-retro-primary text-lg font-bold">
          {name ? name.charAt(0).toUpperCase() : "📷"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${dimensions.className} relative rounded-md overflow-hidden`}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-retro-primary/5 flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-retro-primary"></div>
        </div>
      )}
      <Image
        src={currentSrc}
        alt={name}
        width={dimensions.width}
        height={dimensions.height}
        className={`${dimensions.className} rounded-md pixelated object-cover`}
        unoptimized
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </div>
  );
}
