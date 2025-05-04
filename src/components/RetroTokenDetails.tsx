import React from "react";
import { RetroInput } from "./ui/RetroInput";
import { RetroStepScreen } from "./RetroStepScreen";
import { RetroDivider } from "./RetroDivider";
import { RetroButton } from "./ui/RetroButton";
import { toast } from "react-hot-toast";

interface RetroTokenDetailsProps {
  name: string;
  symbol: string;
  aiSuggestion: {
    name: string;
    symbol: string;
    description: string;
  } | null;
  onNameChange: (name: string) => void;
  onSymbolChange: (symbol: string) => void;
  onNext: () => void;
  onBack: () => void;
  isLoading: boolean;
}

export function RetroTokenDetails({
  name,
  symbol,
  aiSuggestion,
  onNameChange,
  onSymbolChange,
  onNext,
  onBack,
  isLoading
}: RetroTokenDetailsProps) {
  const isNextDisabled = !name || !symbol;
  
  // Direct image generation handler
  const handleGenerateImage = async () => {
    console.log("GENERATE IMAGE button clicked!");
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    
    if (isNextDisabled) {
      console.log("Button is disabled - can't proceed");
      return;
    }
    
    // Try the regular onNext function first
    try {
      if (typeof onNext === 'function') {
        console.log("Calling onNext function to generate image...");
        onNext();
        console.log("onNext function called successfully");
        return;
      }
    } catch (error) {
      console.error("Error calling onNext for image generation:", error);
    }
    
    // Fallback - direct API call
    toast.loading("Generating token image...", { id: 'status-toast' });
    
    try {
      console.log("Making direct API call for image generation");
      const description = aiSuggestion?.description || "";
      
      const apiUrl = `${window.location.origin}/api/ai`;
      console.log("Making direct API request to:", apiUrl);
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "image",
          name: name,
          symbol: symbol,
          description: description
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Image API response:", data);
      
      toast.success("Image generated successfully", { id: 'status-toast' });
      
      // Force refresh to simulate advancement
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Failed to generate image. Please try again.", { id: 'status-toast' });
    }
  };

  return (
    <div className="animate-fade-in transition-all duration-300">
      <RetroStepScreen
        title="Token Details"
        hideButtons={true}
        className="mb-4 overflow-hidden"
      >
        {aiSuggestion && (
          <div className="mb-6 p-4 rounded-sm border border-retro-primary bg-gradient-to-r from-retro-darker  transform transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,107,53,0.3)] hover:scale-[1.01]">
            <h3 className="text-retro-secondary text-sm font-bold mb-2 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              AI Suggestion
            </h3>
            <div className="text-retro-accent text-sm leading-relaxed  p-3 rounded-md">{aiSuggestion.description}</div>
          </div>
        )}
        
        <RetroDivider text="Token Information" />
        
        <div className="grid gap-5 mb-4">
          <div className="transform transition-all duration-300 hover:translate-x-1">
            <RetroInput
              label="Token Name"
              value={name}
              onChange={e => onNameChange(e.target.value)}
              placeholder="Enter a memorable name"
              className="bg-retro-darker/80 focus:bg-retro-darker transition-colors duration-300"
            />
            <p className="text-xs text-retro-secondary mt-1 ml-1 italic">A unique and memorable name for your token</p>
          </div>
          
          <div className="transform transition-all duration-300 hover:translate-x-1">
            <RetroInput
              label="Token Symbol"
              value={symbol.toUpperCase()}
              onChange={e => onSymbolChange(e.target.value.toUpperCase())}
              placeholder="3-4 letters (e.g. BTC)"
              maxLength={4}
              className="bg-retro-darker/80 focus:bg-retro-darker transition-colors duration-300"
            />
            <p className="text-xs text-retro-secondary mt-1 ml-1 italic">Short identifier for exchanges (3-4 characters)</p>
          </div>
        </div>
        
        <div className="text-xs text-retro-accent mt-5 p-3 rounded-none border-2 border-retro-primary">
          <div className="flex items-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-retro-primary">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p className="font-semibold">Helpful Tips:</p>
          </div>
          <p className="ml-6 mb-1">• AI has suggested a name and symbol</p>
          <p className="ml-6">• You can modify these or keep the suggestions</p>
        </div>
      </RetroStepScreen>
      
      {/* Navigation buttons */}
      <div className="flex gap-4 mt-6">
        <RetroButton
          variant="outline"
          onClick={onBack}
          fullWidth
          className="transition-all duration-300 hover:bg-retro-primary/10"
        >
          <span className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
            Back
          </span>
        </RetroButton>
        
        <RetroButton
          onClick={handleGenerateImage}
          isLoading={isLoading}
          disabled={isNextDisabled}
          fullWidth
          className="transition-all duration-300 bg-gradient-to-r from-retro-primary to-retro-primary/80 hover:shadow-[0_0_15px_rgba(255,107,53,0.4)]"
        >
          <span className="flex items-center justify-center">
            Generate Image
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </span>
        </RetroButton>
      </div>
      
      {/* Instruction text */}
      <div className="mt-6 p-4 bg-gradient-to-r from-retro-primary/20 to-retro-primary/5 rounded-sm border border-retro-primary transition-all duration-300 hover:shadow-[0_0_10px_rgba(255,107,53,0.2)]">
        <p className="text-retro-accent text-sm text-center flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-retro-primary">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          Click the Generate Image button to create your token artwork
        </p>
      </div>
    </div>
  );
} 