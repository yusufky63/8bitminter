import React from 'react';
import { type Coin } from '../services/coinService';
import { formatDistanceToNow } from 'date-fns';
import { SafeImage } from './ui/SafeImage';
import { Star, Eye, Users, ExternalLink } from 'lucide-react';

interface CoinCardProps {
  coin: Coin;
  onClick?: () => void;
}

export function CoinCard({ coin, onClick }: CoinCardProps) {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
  };

  const openBasescan = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://basescan.org/address/${coin.contract_address}`, '_blank');
  };

  const viewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Set session storage flags for navigation
    sessionStorage.setItem('viewTokenAddress', coin.contract_address);
    sessionStorage.setItem('viewTokenDetails', 'true');
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('viewCoinDetails', {
      detail: { tokenAddress: coin.contract_address }
    }));
    
    if (onClick) onClick();
  };

  return (
    <div 
      className="bg-retro-darker border-2 border-retro-primary hover:border-retro-accent transition-all duration-300 cursor-pointer group relative overflow-hidden"
      onClick={onClick}
    >

      {/* Coin Image */}
      <div className="relative aspect-square overflow-hidden border-b-2 border-retro-primary">
        <SafeImage
          src={coin.image_url}
          alt={coin.name}
          width={300}
          height={300}
          className="w-full h-full transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Overlay with action */}
        <div className="absolute inset-0 bg-retro-darker/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <button
            onClick={viewDetails}
            className="bg-retro-primary text-retro-darker px-3 py-1 text-xs font-bold hover:bg-retro-accent transition-colors flex items-center gap-1"
            title="View Details"
          >
            <Eye size={12} />
            VIEW
          </button>
        </div>

        {/* Category Badge */}
        <div className="absolute top-2 right-2 bg-retro-accent text-retro-darker px-2 py-1 text-xs font-bold">
          {coin.category}
        </div>

        {/* Currency Badge */}
        <div className="absolute bottom-2 right-2 bg-retro-darker/80 text-retro-primary px-2 py-1 text-xs font-bold border border-retro-primary">
          {coin.currency || 'ETH'}
        </div>
      </div>

      {/* Coin Info */}
      <div className="p-3">
        {/* Title and Symbol */}
        <div className="mb-2">
          <h3 className="text-sm font-bold text-retro-accent group-hover:text-retro-primary transition-colors truncate">
            {coin.name.length > 15 ? `${coin.name.slice(0, 15)}...` : coin.name}
          </h3>
          <div className="text-retro-primary font-mono text-xs">
            ${coin.symbol.length > 8 ? `${coin.symbol.slice(0, 8)}...` : coin.symbol}
          </div>
        </div>

        {/* Description */}
        <p className="text-retro-secondary text-xs mb-3 line-clamp-2">
          {coin.description && coin.description.length > 60 
            ? `${coin.description.slice(0, 60)}...` 
            : coin.description || 'No description'}
        </p>

        {/* Creator and Date */}
        <div className="flex items-center justify-between mb-2 text-xs">
          <div className="text-retro-secondary">
            <span className="text-retro-accent font-mono text-xs">
              {formatAddress(coin.creator_address)}
            </span>
          </div>
          <div className="text-retro-secondary text-xs">
            {formatDate(coin.created_at)}
          </div>
        </div>

        {/* Stats */}
        <div className="text-xs text-center p-2 bg-retro-primary/10 border border-retro-primary">
          {coin.holders !== undefined && (
            <div className="text-retro-primary font-bold flex items-center justify-center gap-1 text-xs">
              <Users size={10} />
              {coin.holders} holders
            </div>
          )}
          
          {/* Market Cap and Volume */}
          <div className="flex justify-center gap-3 text-retro-secondary">
            {(coin as any).marketCap && (
              <span className="flex items-center gap-1">
                MC: ${formatNumber((coin as any).marketCap)}
              </span>
            )}
            {(coin as any).volume24h && (
              <span className="flex items-center gap-1">
                VOL: ${formatNumber((coin as any).volume24h)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 