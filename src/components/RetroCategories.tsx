import React from "react";
import { RetroSelect } from "./ui/RetroSelect";
import { RetroTextarea } from "./ui/RetroTextarea";
import { RetroStepScreen } from "./RetroStepScreen";
import { RetroButton } from "./ui/RetroButton";
import { toast } from "react-hot-toast";

interface RetroCategoriesProps {
  category: string;
  description: string;
  categories: Array<{ name: string; features: string }>;
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
  const categoryOptions = categories.map(cat => ({
    value: cat.name,
    label: cat.name
  }));
  
  // Add empty option
  categoryOptions.unshift({ value: "", label: "Choose a category" });

  const isNextDisabled = !category || !description || description.length < 3;
  
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

  return (
    <div>
      <RetroStepScreen
        title="DEFINE YOUR COIN"
        hideButtons={true} // Hide default buttons, we'll use our own
        className="mb-3"
      >
        <RetroSelect
          label="TOKEN CATEGORY"
          options={categoryOptions}
          value={category}
          onChange={onCategoryChange}
        />
        
        <RetroTextarea
          label="DESCRIBE YOUR TOKEN"
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          placeholder="Enter details about your token's purpose, audience, and special features..."
        />
        
        <div className="text-xs text-retro-accent mt-2 font-mono">
          <p className="mb-1">* SELECT A CATEGORY AND PROVIDE A DETAILED DESCRIPTION</p>
          <p>* THE AI WILL USE THIS TO GENERATE YOUR TOKEN</p>
          {category === "" && (
            <p className="text-retro-error mt-1">* CATEGORY NOT SELECTED</p>
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
      
      {/* Large, prominent action button */}
      <div className="mt-4 text-center">
       
        
        <RetroButton
          onClick={handleAnalyzeClick}
          isLoading={isLoading}
          disabled={isNextDisabled}
          className="py-4 w-full text-lg"
        >
          <span className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="mr-2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            {isLoading ? "ANALYZING..." : "ANALYZE TOKEN DATA"}
          </span>
        </RetroButton>
      </div>
    </div>
  );
} 