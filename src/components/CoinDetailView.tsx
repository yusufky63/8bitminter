import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { RetroButton } from './ui/RetroButton';
import { SafeImage } from './ui/SafeImage';



export function CoinDetailView({ coin, onBack }: { coin: any; onBack: () => void }) {
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return {
        relative: formatDistanceToNow(date, { addSuffix: true }),
        absolute: date.toLocaleString()
      };
    } catch {
      return {
        relative: 'Recently',
        absolute: 'Unknown'
      };
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    // You can add a toast notification here
    console.log(`${label} copied to clipboard: ${text}`);
  };

  const openBasescan = () => {
    window.open(`https://basescan.org/address/${coin.contract_address}`, '_blank');
  };

  const openZora = () => {
    window.open(`https://zora.co/coin/${coin.contract_address}`, '_blank');
  };

  const openCreatorBasescan = () => {
    window.open(`https://basescan.org/address/${coin.creator_address}`, '_blank');
  };

  const openTransactionBasescan = () => {
    window.open(`https://basescan.org/tx/${coin.tx_hash}`, '_blank');
  };



  const dateInfo = formatDate(coin.created_at);

  return (
    <div className="min-h-screen bg-retro-darker">
      {/* Header */}
      <div className="bg-gradient-to-r from-retro-primary/20 to-retro-primary/5 border-b-2 border-retro-primary">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            {onBack && (
              <RetroButton onClick={onBack} variant="outline">
                ← Back
              </RetroButton>
            )}
            <div>
              <h1 className="text-3xl font-bold text-retro-accent">{coin.name}</h1>
              <div className="text-retro-primary font-mono text-lg">${coin.symbol}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Image and Quick Actions */}
          <div className="space-y-6">
            {/* Coin Image */}
            <div className="aspect-square bg-retro-darker border-2 border-retro-primary overflow-hidden">
              <SafeImage
                src={coin.image_url}
                alt={coin.name}
                width={600}
                height={600}
                className="w-full h-full"
                fallbackText="NO IMAGE"
                fallbackIcon="📷"
              />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <RetroButton onClick={openZora} className="w-full">
                🚀 Trade on Zora
              </RetroButton>
              <RetroButton onClick={openBasescan} variant="outline" className="w-full">
                📊 View on Basescan
              </RetroButton>
            </div>

            {/* Category and Currency */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-retro-darker/50 border-2 border-retro-primary p-4">
                <div className="text-retro-secondary text-sm mb-1">Category</div>
                <div className="text-retro-accent font-medium">{coin.category}</div>
              </div>
              <div className="bg-retro-darker/50 border-2 border-retro-primary p-4">
                <div className="text-retro-secondary text-sm mb-1">Currency</div>
                <div className="text-retro-accent font-medium">{coin.currency}</div>
              </div>
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Description */}
            <div className="bg-retro-darker/50 border-2 border-retro-primary p-6">
              <h3 className="text-xl font-bold text-retro-accent mb-4">Description</h3>
              <p className="text-retro-secondary leading-relaxed">{coin.description}</p>
            </div>

            {/* Contract Information */}
            <div className="bg-retro-darker/50 border-2 border-retro-primary p-6">
              <h3 className="text-xl font-bold text-retro-accent mb-4">Contract Information</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-retro-secondary text-sm mb-1">Contract Address</div>
                  <div className="flex items-center gap-2">
                    <code className="text-retro-primary font-mono text-sm bg-retro-darker p-2 flex-1">
                      {coin.contract_address}
                    </code>
                    <button
                      onClick={() => copyToClipboard(coin.contract_address, 'Contract address')}
                      className="text-retro-accent hover:text-retro-primary transition-colors p-1"
                      title="Copy address"
                    >
                      📋
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-retro-secondary text-sm mb-1">Chain</div>
                  <div className="text-retro-accent">Base (Chain ID: {coin.chain_id})</div>
                </div>

                <div>
                  <div className="text-retro-secondary text-sm mb-1">Transaction Hash</div>
                  <div className="flex items-center gap-2">
                    <code className="text-retro-primary font-mono text-sm bg-retro-darker p-2 flex-1">
                      {formatAddress(coin.tx_hash)}
                    </code>
                    <button
                      onClick={openTransactionBasescan}
                      className="text-retro-accent hover:text-retro-primary transition-colors p-1"
                      title="View transaction"
                    >
                      🔗
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Creator Information */}
            <div className="bg-retro-darker/50 border-2 border-retro-primary p-6">
              <h3 className="text-xl font-bold text-retro-accent mb-4">Creator</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-retro-secondary text-sm mb-1">Creator Address</div>
                  <div className="flex items-center gap-2">
                    <code className="text-retro-primary font-mono text-sm bg-retro-darker p-2 flex-1">
                      {coin.creator_address}
                    </code>
                    <button
                      onClick={() => copyToClipboard(coin.creator_address, 'Creator address')}
                      className="text-retro-accent hover:text-retro-primary transition-colors p-1"
                      title="Copy address"
                    >
                      📋
                    </button>
                    <button
                      onClick={openCreatorBasescan}
                      className="text-retro-accent hover:text-retro-primary transition-colors p-1"
                      title="View on Basescan"
                    >
                      🔗
                    </button>
                  </div>
                </div>

                {coin.platform_referrer && (
                  <div>
                    <div className="text-retro-secondary text-sm mb-1">Platform Referrer</div>
                    <code className="text-retro-primary font-mono text-sm bg-retro-darker p-2 block">
                      {coin.platform_referrer}
                    </code>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-retro-darker/50 border-2 border-retro-primary p-6">
              <h3 className="text-xl font-bold text-retro-accent mb-4">Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-retro-secondary text-sm mb-1">Holders</div>
                  <div className="text-retro-accent text-lg font-medium">👥 {coin.holders}</div>
                </div>
                <div>
                  <div className="text-retro-secondary text-sm mb-1">Created</div>
                  <div className="text-retro-accent" title={dateInfo.absolute}>
                    🕒 {dateInfo.relative}
                  </div>
                </div>
              </div>

              {(coin.current_price || coin.volume_24h || coin.total_supply) && (
                <div className="mt-4 pt-4 border-t border-retro-primary/30">
                  <div className="grid grid-cols-1 gap-3">
                    {coin.current_price && (
                      <div>
                        <div className="text-retro-secondary text-sm mb-1">Current Price</div>
                        <div className="text-retro-accent font-medium">{coin.current_price}</div>
                      </div>
                    )}
                    {coin.volume_24h && (
                      <div>
                        <div className="text-retro-secondary text-sm mb-1">24h Volume</div>
                        <div className="text-retro-accent font-medium">{coin.volume_24h}</div>
                      </div>
                    )}
                    {coin.total_supply && (
                      <div>
                        <div className="text-retro-secondary text-sm mb-1">Total Supply</div>
                        <div className="text-retro-accent font-medium">{coin.total_supply}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 