import React from 'react';
import { SafeImage } from './ui/SafeImage';

export interface RetroToken {
  address: string;
  name: string;
  symbol: string;
  image?: string;
  description?: string;
  priceUsd?: number; // current price in USD
  marketCapUsd?: number;
  volume24hUsd?: number;
  change24hPct?: number; // percent change 24h
  holders?: number;
  createdAt?: string;
  currency?: string; // pool currency (ETH/WETH/ZORA)
  creatorHandle?: string;
}

function formatNumber(value?: number): string {
  if (value === undefined || value === null || isNaN(value as any)) return 'N/A';
  const num = Number(value);
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  if (num < 0.001 && num > 0) return '<0.001';
  return num.toFixed(num < 1 ? 4 : 2);
}

function formatChange(value?: number): { text: string; color: string } {
  if (value === undefined || value === null || isNaN(value as any)) return { text: 'N/A', color: 'text-retro-secondary' };
  const num = Number(value);
  const sign = num >= 0 ? '+' : '';
  const color = num >= 0 ? 'text-green-400' : 'text-red-400';
  return { text: `${sign}${num.toFixed(2)}%`, color };
}

export function RetroTokenCard({ token, onClick, variant = 'list' }: { token: RetroToken; onClick?: (address: string) => void; variant?: 'card' | 'list' }) {
  const hasChange = token.change24hPct !== undefined && token.change24hPct !== null && !isNaN(Number(token.change24hPct));
  const change = hasChange ? formatChange(Number(token.change24hPct)) : null;

  // Compact row variant (no big image)
  if (variant === 'list') {
    return (
      <div
        className="bg-retro-darker border-2 border-retro-primary hover:border-retro-accent transition-all duration-200 cursor-pointer group p-2 flex items-center gap-3"
        onClick={() => onClick?.(token.address)}
      >
        {/* Small thumbnail */}
        <div className="w-12 h-12 border border-retro-primary overflow-hidden flex items-center justify-center bg-retro-primary/10">
          {token.image ? (
            <SafeImage src={token.image} alt={token.name} width={48} height={48} className="w-full h-full object-cover bg-black/30" />
          ) : (
            <span className="text-retro-primary text-sm font-bold">
              {token.symbol?.[0]?.toUpperCase() || token.name?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="truncate">
              <span className="text-sm font-bold text-retro-accent group-hover:text-retro-primary transition-colors truncate">
                {token.name}
              </span>
              {token.symbol && (
                <span className="ml-1 text-xs text-retro-secondary truncate">({token.symbol})</span>
              )}
            </div>
            {hasChange && (
              <div className={`text-xs font-mono whitespace-nowrap ${change!.color}`}>{change!.text}</div>
            )}
          </div>

          {/* Compact stats (no inner borders) */}
          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
            <div className="px-1 py-1">
              <div className="text-retro-secondary text-[10px]">MC</div>
              <div className="text-retro-accent font-mono text-sm">${formatNumber(token.marketCapUsd)}</div>
            </div>
            <div className="px-1 py-1">
              <div className="text-retro-secondary text-[10px]">24H</div>
              <div className="text-retro-accent font-mono text-sm">${formatNumber(token.volume24hUsd)}</div>
            </div>
            <div className="px-1 py-1">
              <div className="text-retro-secondary text-[10px]">HOLD</div>
              <div className="text-retro-primary font-mono text-sm">{token.holders ?? 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-retro-darker border-2 border-retro-primary hover:border-retro-accent transition-all duration-200 cursor-pointer group"
      onClick={() => onClick?.(token.address)}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden border-b-2 border-retro-primary">
        {token.image ? (
          <SafeImage
            src={token.image}
            alt={token.name}
            fluid
            className="w-full h-full object-contain bg-black/30 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-retro-primary/10 flex items-center justify-center text-retro-primary text-xs">
            NO IMAGE
          </div>
        )}

        {/* Symbol badge */}
        <div className="absolute top-2 left-2 bg-retro-darker/80 border border-retro-primary text-retro-primary text-xs font-bold px-2 py-0.5">
          {token.symbol || 'N/A'}
        </div>
        {/* Currency badge */}
        {token.currency && (
          <div className="absolute top-2 right-2 bg-retro-accent text-retro-darker text-xs font-bold px-2 py-0.5">
            {token.currency}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-baseline gap-1 truncate max-w-[70%]">
            <h3 className="text-base font-bold text-retro-accent group-hover:text-retro-primary transition-colors truncate">
              {token.name}
            </h3>
            {token.symbol && (
              <span className="text-xs text-retro-secondary truncate">({token.symbol})</span>
            )}
          </div>
          {hasChange && (
            <div className={`text-xs font-mono ${change!.color}`}>{change!.text}</div>
          )}
        </div>

        {token.description && (
          <p className="text-retro-secondary text-xs mb-2 line-clamp-2">{token.description}</p>
        )}

        {/* Stats grid (no PRICE) */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 bg-black/40 border border-retro-primary">
            <div className="text-retro-secondary text-xs">MC</div>
            <div className="text-retro-accent font-mono text-sm">${formatNumber(token.marketCapUsd)}</div>
          </div>
          <div className="p-2 bg-black/40 border border-retro-primary">
            <div className="text-retro-secondary text-xs">24H VOL</div>
            <div className="text-retro-accent font-mono text-sm">${formatNumber(token.volume24hUsd)}</div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 text-sm">
          <div className="text-retro-secondary text-xs">HOLDERS</div>
          <div className="text-retro-primary font-mono text-sm">{token.holders ?? 'N/A'}</div>
        </div>
      </div>
    </div>
  );
}
