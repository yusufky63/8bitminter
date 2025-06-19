import React from "react";
import { RetroInput } from "./ui/RetroInput";
import { RetroStepScreen } from "./RetroStepScreen";
import { RetroDivider } from "./RetroDivider";
import { RetroButton } from "./ui/RetroButton";
import { toast } from "react-hot-toast";
import { Info, ArrowLeft, Camera, Zap } from "lucide-react";

interface RetroTokenDetailsProps {
  name: string;
  symbol: string;
  description: string;
  aiSuggestion: {
    name: string;
    symbol: string;
    description: string;
  } | null;
  onNameChange: (name: string) => void;
  onSymbolChange: (symbol: string) => void;
  onDescriptionChange: (description: string) => void;
  onNext: () => void;
  onBack: () => void;
  isLoading: boolean;
}

export function RetroTokenDetails({
  name,
  symbol,
  description,
  aiSuggestion,
  onNameChange,
  onSymbolChange,
  onDescriptionChange,
  onNext,
  onBack,
  isLoading
}: RetroTokenDetailsProps) {
  const isNextDisabled = !name || !symbol || !description;
  
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
          
                      <div className="transform transition-all duration-300 hover:translate-x-1">
              <label className="block text-retro-secondary text-sm font-medium mb-2">
                Token Description
              </label>
              <textarea
                value={description}
                onChange={e => onDescriptionChange(e.target.value)}
                placeholder="Describe your token's purpose and features"
                rows={3}
                className="w-full px-3 py-2 bg-retro-darker border-2 border-retro-primary text-white placeholder-retro-secondary/50 transition-colors duration-300 resize-none focus:outline-none focus:border-retro-accent focus:bg-retro-darker"
              />
              <p className="text-xs text-retro-secondary mt-1 ml-1 italic">Brief description for your token (will be included in metadata)</p>
            </div>
        </div>
        
        <div className="text-xs text-retro-accent mt-5 p-3 rounded-none border-2 border-retro-primary">
          <div className="flex items-center mb-2">
            <Info size={16} className="mr-2 text-retro-primary" />
            <p className="font-semibold">Helpful Tips:</p>
          </div>
          <p className="ml-6 mb-1">• AI has suggested name, symbol and description</p>
          <p className="ml-6">• You can modify these fields or keep the suggestions</p>
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
            <ArrowLeft size={16} className="mr-2" />
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
            <Camera size={16} className="ml-2" />
          </span>
        </RetroButton>
      </div>
      
      {/* Instruction text */}
      <div className="mt-6 p-4 bg-gradient-to-r from-retro-primary/20 to-retro-primary/5 rounded-sm border border-retro-primary transition-all duration-300 hover:shadow-[0_0_10px_rgba(255,107,53,0.2)]">
        <p className="text-retro-accent text-sm text-center flex items-center justify-center">
          <Zap size={18} className="mr-2 text-retro-primary" />
          Click the Generate Image button to create your token artwork
        </p>
      </div>
    </div>
  );
} 