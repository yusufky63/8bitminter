import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { detectEnvironment, getBaseAppContext, getFarcasterUserContext } from '../utils/wallet';

interface HeaderProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  userName?: string;
}

interface UserInfo {
  name?: string;
  type?: 'basename' | 'farcaster' | 'custom';
  fid?: number;
}

export default function RetroHeader({
  activeTab = "create",
  onTabChange,
  userName,
}: HeaderProps) {
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [userInfo, setUserInfo] = useState<UserInfo>({});
  const { address, isConnected } = useAccount();

  // Fetch user info based on environment
  useEffect(() => {
    const fetchUserInfo = async () => {
      // If userName prop is provided, use it
      if (userName) {
        setUserInfo({ name: userName, type: 'custom' });
        return;
      }

      const environment = detectEnvironment();
      
      try {
        if (environment === 'baseapp') {
          const baseAppContext = await getBaseAppContext();
          if (baseAppContext?.basename) {
            setUserInfo({
              name: baseAppContext.basename,
              type: 'basename',
              fid: baseAppContext.fid
            });
            return;
          }
        }

        if (environment === 'farcaster' || environment === 'baseapp') {
          const farcasterContext = await getFarcasterUserContext();
          if (farcasterContext?.username || farcasterContext?.displayName) {
            setUserInfo({
              name: farcasterContext.username || farcasterContext.displayName,
              type: 'farcaster',
              fid: farcasterContext.fid
            });
            return;
          }
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };

    fetchUserInfo();
  }, [userName]);

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  return (
    <div className="w-full mb-1 sticky top-0 z-50">
      <div className="crt-effect retro-container py-1 mb-0.5">
        <div className="retro-grid-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-10 h-10 mr-3 pixelated"
              />
              <h1 className="text-xl font-bold tracking-tight text-retro-accent font-mono">
                8BitCoiner
              </h1>
            </div>
            <div className="flex items-center">
              <div className="text-[10px] leading-tight text-retro-accent px-2 py-1 border border-retro-primary rounded flex flex-col items-end">
                {userInfo.name && (
                  <div>
                    <span className="opacity-70 mr-1">
                      {userInfo.type === 'basename' ? 'BASE:' : userInfo.type === 'farcaster' ? 'FC:' : ''}
                    </span>
                    <span className="truncate max-w-[160px] inline-block align-top">{userInfo.name}</span>
                  </div>
                )}
                <div className={userInfo.name ? 'mt-0.5' : ''}>
                  <span className="opacity-70 mr-1">WALLET:</span>
                  {isConnected && address ? (
                    `${address.substring(0, 3)}...${address.substring(address.length - 2)}`
                  ) : (
                    <span className="opacity-80">NOT CONNECTED</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center font-mono text-[10px] text-retro-secondary mb-1">
        CREATE PIXEL-PERFECT TOKENS ON FARCASTER{" "}
        <span className="retro-blink">▌</span>
      </div>

      <div className="retro-container p-0.5 mb-0">
        <div className="grid grid-cols-3 gap-0.5">
          <button
            className={`retro-button py-0.5 text-xs ${
              currentTab === "create"
                ? "bg-retro-primary"
                : "bg-retro-primary/5 border border-retro-primary text-retro-primary"
            }`}
            onClick={() => handleTabChange("create")}
          >
            CREATE
          </button>
          <button
            className={`retro-button py-0.5 text-xs ${
              currentTab === "hold"
                ? "bg-retro-primary"
                : "bg-retro-primary/5 border border-retro-primary text-retro-primary"
            }`}
            onClick={() => handleTabChange("hold")}
          >
            HOLD
          </button>
          <button
            className={`retro-button py-0.5 text-xs ${
              currentTab === "explore"
                ? "bg-retro-primary"
                : "bg-retro-primary/5 border border-retro-primary text-retro-primary"
            }`}
            onClick={() => handleTabChange("explore")}
          >
            EXPLORE
          </button>
        </div>
      </div>
    </div>
  );
}
