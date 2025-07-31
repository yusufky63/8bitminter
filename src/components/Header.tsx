import React, { useState, useEffect } from "react";
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
    <div className="w-full mb-1">
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
            {userInfo.name && (
              <div className="text-xs text-retro-accent px-2 py-1 border border-retro-primary rounded">
                <span className="opacity-70">
                  {userInfo.type === 'basename' ? 'BASE:' : 
                   userInfo.type === 'farcaster' ? 'FC:' : ''}
                </span> {userInfo.name}
              </div>
            )}
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
