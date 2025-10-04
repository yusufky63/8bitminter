import React from 'react';

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
  if (value === undefined || value === null || isNaN(value)) return 'N/A';
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + 'B';
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(2) + 'K';
  if (value < 0.001 && value > 0) return '<0.001';
  return value.toFixed(value < 1 ? 4 : 2);
}

function formatChange(value?: number): { text: string; color: string } {
  if (value === undefined || value === null || isNaN(value)) return { text: '—', color: 'text-retro-secondary' };
  const sign = value >= 0 ? '+' : '';
  const color = value >= 0 ? 'text-green-400' : 'text-red-400';
  return { text: `${sign}${value.toFixed(2)}%`, color };
}

export function RetroTokenCard({ token, onClick }: { token: RetroToken; onClick?: (address: string) => void }) {
  const change = formatChange(token.change24hPct);
  return (
    <div
      className="bg-retro-darker border-2 border-retro-primary hover:border-retro-accent transition-all duration-200 cursor-pointer group"
      onClick={() => onClick?.(token.address)}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden border-b-2 border-retro-primary">
        {token.image ? (
          // Next/Image optional; use plain img to avoid config issues
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={token.image}
            alt={token.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-retro-primary/10 flex items-center justify-center text-retro-primary text-xs">
            NO IMAGE
          </div>
        )}

        {/* Symbol badge */}
        <div className="absolute top-2 left-2 bg-retro-darker/80 border border-retro-primary text-retro-primary text-[10px] font-bold px-2 py-0.5">
          {token.symbol}
        </div>
        {/* Currency badge */}
        {token.currency && (
          <div className="absolute top-2 right-2 bg-retro-accent text-retro-darker text-[10px] font-bold px-2 py-0.5">
            {token.currency}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-bold text-retro-accent group-hover:text-retro-primary transition-colors truncate max-w-[70%]">
            {token.name}
          </h3>
          <div className={`text-[10px] font-mono ${change.color}`}>{change.text}</div>
        </div>

        {token.description && (
          <p className="text-retro-secondary text-[11px] mb-2 line-clamp-2">{token.description}</p>
        )}

        {/* Stats grid (no PRICE) */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 bg-black/40 border border-retro-primary">
            <div className="text-retro-secondary">MC</div>
            <div className="text-retro-accent font-mono">${formatNumber(token.marketCapUsd)}</div>
          </div>
          <div className="p-2 bg-black/40 border border-retro-primary">
            <div className="text-retro-secondary">24H VOL</div>
            <div className="text-retro-accent font-mono">${formatNumber(token.volume24hUsd)}</div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 text-[11px]">
          <div className="text-retro-secondary">Holders</div>
          <div className="text-retro-primary font-mono">{token.holders ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
