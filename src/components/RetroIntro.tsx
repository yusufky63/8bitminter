import React from "react";
import Image from "next/image";
import { RetroStepScreen } from "./RetroStepScreen";
import { RetroButton } from "./ui/RetroButton";

interface RetroIntroProps {
  onGetStarted: () => void;
}

export function RetroIntro({ onGetStarted }: RetroIntroProps) {
  return (
    <RetroStepScreen
      title="WELCOME TO COIN CREATOR"
      hideButtons={true}
    >
      <div className="text-center mb-6">
        
        
        <div className="mb-4 text-retro-accent font-mono">
          <p className="text-sm mb-2">CREATE YOUR OWN CRYPTO TOKEN WITH RETRO STYLE</p>
          <p className="text-xs">POWERED BY AI • DEPLOYED ON FARCASTER</p>
        </div>
        
        
        <div className="retro-grid-background border-2 border-retro-primary p-4">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-retro-dark text-retro-primary font-mono flex items-center justify-center border-2 border-retro-primary mr-3">
              1
            </div>
            <div className="text-left">
              <h3 className="text-retro-secondary font-mono">DESCRIBE YOUR IDEA</h3>
              <p className="text-xs text-retro-accent font-mono">CHOOSE CATEGORY AND PURPOSE</p>
            </div>
          </div>
          
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-retro-dark text-retro-primary font-mono flex items-center justify-center border-2 border-retro-primary mr-3">
              2
            </div>
            <div className="text-left">
              <h3 className="text-retro-secondary font-mono">AI GENERATES DETAILS</h3>
              <p className="text-xs text-retro-accent font-mono">CUSTOMIZE NAME AND SYMBOL</p>
            </div>
          </div>
          
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-retro-dark text-retro-primary font-mono flex items-center justify-center border-2 border-retro-primary mr-3">
              3
            </div>
            <div className="text-left">
              <h3 className="text-retro-secondary font-mono">CREATE PIXEL ART</h3>
              <p className="text-xs text-retro-accent font-mono">AI GENERATES UNIQUE IMAGE</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="w-8 h-8 bg-retro-dark text-retro-primary font-mono flex items-center justify-center border-2 border-retro-primary mr-3">
              4
            </div>
            <div className="text-left">
              <h3 className="text-retro-secondary font-mono">MINT YOUR TOKEN</h3>
              <p className="text-xs text-retro-accent font-mono">DEPLOY TO THE BLOCKCHAIN</p>
            </div>
          </div>
        </div>
      </div>
      
      <RetroButton
        onClick={onGetStarted}
        fullWidth
      >
        <span className="flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="mr-2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          START MISSION
        </span>
      </RetroButton>
    </RetroStepScreen>
  );
} 