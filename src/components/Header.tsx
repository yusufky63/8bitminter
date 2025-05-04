import React, { useState } from "react";
import Image from "next/image";

interface HeaderProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function RetroHeader({ activeTab = "create", onTabChange }: HeaderProps) {
  const [currentTab, setCurrentTab] = useState(activeTab);
  
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
          <div className="flex items-center justify-center gap-2">
         
            <h1 className="retro-header text-center retro-glow text-base font-bold tracking-wider py-1">
              VisionZ Coin Maker
            </h1>
          </div>
        </div>
      </div>
      
      <div className="text-center font-mono text-[10px] text-retro-secondary mb-1">
        CREATE PIXEL-PERFECT TOKENS ON FARCASTER <span className="retro-blink">▌</span>
      </div>
      
      <div className="retro-container p-0.5 mb-0">
        <div className="grid grid-cols-3 gap-0.5">
          <button 
            className={`retro-button py-0.5 text-xs ${currentTab === "create" ? "bg-retro-primary" : "bg-retro-primary/5 border border-retro-primary text-retro-primary"}`}
            onClick={() => handleTabChange("create")}
          >
            CREATE
          </button>
          <button 
            className={`retro-button py-0.5 text-xs ${currentTab === "hold" ? "bg-retro-primary" : "bg-retro-primary/5 border border-retro-primary text-retro-primary"}`}
            onClick={() => handleTabChange("hold")}
          >
            HOLD
          </button>
          <button 
            className={`retro-button py-0.5 text-xs ${currentTab === "explore" ? "bg-retro-primary" : "bg-retro-primary/5 border border-retro-primary text-retro-primary"}`}
            onClick={() => handleTabChange("explore")}
          >
            EXPLORE
          </button>
        </div>
      </div>
    </div>
  );
} 