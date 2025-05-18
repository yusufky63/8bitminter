import React, { useState } from "react";
import { RetroSelect } from "./ui/RetroSelect";
import { RetroTextarea } from "./ui/RetroTextarea";
import { RetroStepScreen } from "./RetroStepScreen";
import { RetroButton } from "./ui/RetroButton";
import { toast } from "react-hot-toast";
import { RetroDivider } from "./RetroDivider";

interface RetroCategoriesProps {
  category: string;
  description: string;
  categories: Array<{ name: string; features: string; themes: string }>;
  onCategoryChange: (category: string) => void;
  onDescriptionChange: (description: string) => void;
  onNext: () => void;
  isLoading: boolean;
}

export function RetroCategories({
  category,
  description,
  categories,
  onCategoryChange,
  onDescriptionChange,
  onNext,
  isLoading
}: RetroCategoriesProps) {
  const [showCategoryInfo, setShowCategoryInfo] = useState(false);
  
  const categoryOptions = categories.map(cat => ({
    value: cat.name,
    label: cat.name
  }));
  
  // Add empty option
  categoryOptions.unshift({ value: "", label: "Choose a category" });

  const isNextDisabled = !category || !description || description.length < 3;
  
  // Find the selected category object
  const selectedCategory = categories.find(cat => cat.name === category);
  
  // Examples for each category to inspire the user
  const getCategoryExample = (categoryName: string) => {
    switch (categoryName) {
      case "8-Bit Gaming":
        return "PixelQuest: A token for retro gaming enthusiasts that unlocks exclusive pixel games and arcade experiences.";
      case "Pixel Art Collectibles":
        return "BitCanvas: Digital art tokens that showcase limited edition 8-bit masterpieces from pixel artists.";
      case "CryptoVoxel Worlds":
        return "BlockVille: Virtual land tokens for building and owning pieces of a nostalgic 8-bit metaverse.";
      case "Retro Music & Chiptunes":
        return "ChipBeat: Tokens that give access to exclusive chiptune music collections and virtual concerts.";
      case "Arcade Economy":
        return "TokenArcade: An economy system that rewards players with tokens for high scores in retro games.";
      case "Digital Retro Fashion":
        return "PixelWear: Fashion tokens for customizing avatars with retro-styled digital clothing and accessories.";
      case "8-Bit DeFi":
        return "PixelBank: Simplified financial tokens with retro interfaces for staking and earning.";
      case "Retro Social Clubs":
        return "PixelClub: Membership tokens for exclusive retro-themed digital hangout spaces.";
      case "Pixel Pets & Companions":
        return "BitPets: Digital companion tokens inspired by Tamagotchi that evolve based on interaction.";
      case "Retro Tech & Gadgets":
        return "ByteCollector: Tokens representing vintage computer systems and classic gaming consoles.";
      default:
        return "";
    }
  };
  
  // Direct API call for token generation
  const handleAnalyzeClick = async () => {
    console.log("ANALYZE button clicked!");
    console.log("Category:", category);
    console.log("Description:", description);
    
    // More specific error checks
    if (!category) {
      console.log("Button is disabled - category missing");
      toast.error("Please select a category", { id: 'status-toast' });
      return;
    }
    
    if (!description || description.length < 3) {
      console.log("Button is disabled - description too short");
      toast.error("Please provide a description (minimum 3 characters)", { id: 'status-toast' });
      return;
    }
    
    // Show loading state for analysis
    toast.loading("Analyzing your description...", { id: 'status-toast' });
    
    // Forward to onNext handler if provided
    try {
      if (typeof onNext === 'function') {
        console.log("Calling onNext function to generate token details...");
        onNext();
        return;
      }
    } catch (error) {
      console.error("Error processing category selection:", error);
      toast.error("An error occurred. Please try again.", { id: 'status-toast' });
    }
  };

  // Toggle category info display
  const toggleCategoryInfo = () => {
    setShowCategoryInfo(!showCategoryInfo);
  };

  return (
    <div>
      <RetroStepScreen
        title="DEFINE YOUR RETRO TOKEN"
        hideButtons={true} // Hide default buttons, we'll use our own
        className="mb-3"
      >
        
        
        <RetroSelect
          label="TOKEN CATEGORY"
          options={categoryOptions}
          value={category}
          onChange={(val) => {
            onCategoryChange(val);
            setShowCategoryInfo(true);
          }}
        />
        
        {/* Show category details when a category is selected */}
        {category && selectedCategory && (
          <div className="mt-3 mb-4 border-2 border-retro-primary p-2 font-mono">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-retro-accent font-bold pixelated text-sm">{selectedCategory.name}</h3>
              <button 
                onClick={toggleCategoryInfo}
                className="text-xs bg-retro-primary text-white px-2 py-0.5 hover:bg-retro-primary/80"
              >
                {showCategoryInfo ? "HIDE INFO" : "SHOW INFO"}
              </button>
            </div>
            
            {showCategoryInfo && (
              <div className="text-xs text-retro-light">
                <div className="mb-2">
                  <span className="text-retro-secondary">FEATURES:</span> {selectedCategory.features}
                </div>
                <div className="mb-2">
                  <span className="text-retro-secondary">THEMES:</span> {selectedCategory.themes}
                </div>
                <RetroDivider text="EXAMPLE" />
                <div className="p-2 bg-retro-darker mb-2 border border-retro-primary">
                  {getCategoryExample(selectedCategory.name)}
                </div>
              </div>
            )}
          </div>
        )}
        
        <RetroTextarea
          label="DESCRIBE YOUR RETRO TOKEN"
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          placeholder="Enter details about your retro token's purpose, pixel aesthetics, and special 8-bit features..."
        />
        
        <div className="text-xs text-retro-accent mt-2 font-mono">
          <p className="mb-1">* SELECT A CATEGORY AND PROVIDE A DETAILED DESCRIPTION</p>
          <p>* THE AI WILL GENERATE YOUR PIXEL-PERFECT TOKEN</p>
          {category === "" && (
            <p className="text-retro-error mt-1 bg-retro-dark/50 p-1">* CATEGORY NOT SELECTED</p>
          )}
          <div className={`text-xl text-center mb-1 transition-colors duration-300 ${description && description.length < 3 ? 'text-retro-error' : 'text-retro-accent'}`}>
            {description && description.length < 3 && description.length > 0 ? (
              <span className="animate-pulse">MIN 3 CHARACTERS</span>
            ) : (
              <span>&nbsp;</span>
            )}
          </div>
        </div>
      </RetroStepScreen>
      
      {/* Large, prominent action button with pixelated design */}
      <div className="mt-4 text-center">
        <RetroButton
          onClick={handleAnalyzeClick}
          isLoading={isLoading}
          disabled={isNextDisabled}
          className="py-4 w-full text-lg pixelated border-2 border-retro-primary"
        >
          <span className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="mr-2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            {isLoading ? "ANALYZING..." : "GENERATE 8-BIT TOKEN"}
          </span>
        </RetroButton>
      </div>
    </div>
  );
} 