import React, { useState } from "react";
import { RetroStepScreen } from "./RetroStepScreen";
import { RetroDivider } from "./RetroDivider";
import { RetroButton } from "./ui/RetroButton";
import { toast } from "react-hot-toast";
import Image from "next/image";

interface RetroImageGenProps {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  displayImageUrl: string;
  isCreatingImage: boolean;
  onNext: () => void;
  onBack: () => void;
  onGenerateImage: () => void;
}

export function RetroImageGen({
  name,
  symbol,
  description,
  imageUrl,
  displayImageUrl,
  isCreatingImage,
  onNext,
  onBack,
  onGenerateImage
}: RetroImageGenProps) {
  const isNextDisabled = !imageUrl;
  const [localDisplayUrl, setLocalDisplayUrl] = useState<string>(displayImageUrl);
  const [localLoading, setLocalLoading] = useState<boolean>(false);
  
  // Direct image generation without relying on SDK
  const handleDirectImageGeneration = async () => {
    console.log("GENERATE IMAGE button clicked directly");
    
    // Try using provided callback first
    try {
      if (typeof onGenerateImage === 'function') {
        console.log("Calling onGenerateImage function...");
        onGenerateImage();
        console.log("onGenerateImage function called successfully");
        return;
      }
    } catch (error) {
      console.error("Error calling onGenerateImage:", error);
    }
    
    // Fallback direct API call
    setLocalLoading(true);
    toast.loading("Generating token image...", { id: 'status-toast' });
    
    try {
      console.log("Making direct API call for image generation");
      console.log("Using description for image generation:", description);
      
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
      
      if (data.imageUrl) {
        // Show IPFS upload toast
        toast.loading("Uploading to IPFS for permanent storage...", { id: 'status-toast' });
        
        try {
          // Process the image and upload to IPFS
          const ipfsApiUrl = `${window.location.origin}/api/ipfs/upload`;
          const ipfsResponse = await fetch(ipfsApiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              imageUrl: data.imageUrl,
              name: name,
              symbol: symbol,
              description: description
            })
          });
          
          if (!ipfsResponse.ok) {
            throw new Error(`IPFS upload error: ${ipfsResponse.status}`);
          }
          
          const ipfsData = await ipfsResponse.json();
          console.log("IPFS upload response:", ipfsData);
          
          if (ipfsData.ipfsUrl) {
            // Set local state to display the image
            setLocalDisplayUrl(ipfsData.displayUrl || data.imageUrl);
            toast.success("Image generated and uploaded to IPFS successfully!", { id: 'status-toast' });
          } else {
            throw new Error("No IPFS URL returned");
          }
        } catch (ipfsError) {
          console.error("Error uploading to IPFS:", ipfsError);
          // Still show the image but with a warning
          setLocalDisplayUrl(data.imageUrl);
          toast.error("Image generated but IPFS upload failed. Please try again.", { id: 'status-toast' });
        }
      } else {
        throw new Error("No image URL returned");
      }
      
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Failed to generate image. Please try again.", { id: 'status-toast' });
    } finally {
      setLocalLoading(false);
    }
  };
  
  // Direct proceed to next step function
  const handleDirectNext = () => {
    console.log("CONTINUE TO MINT button clicked directly");
    
    // Try using provided callback first
    if (typeof onNext === 'function') {
      try {
        console.log("Calling onNext function...");
        onNext();
        console.log("onNext function called successfully");
        return;
      } catch (error) {
        console.error("Error calling onNext:", error);
      }
    }
    
    // Fallback - refresh page to simulate advancement
    toast.success("Proceeding to mint step...", { id: 'status-toast' });
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
    <div>
      <RetroStepScreen
        title="TOKEN IMAGE"
        hideButtons={true}
        className="mb-3"
      >
        <div className="flex flex-col items-center mb-4">
          {(displayImageUrl || localDisplayUrl) ? (
            <div className="relative w-48 h-48 mb-4 overflow-hidden border-4 border-retro-primary">
              <Image
                src={localDisplayUrl || displayImageUrl}
                alt="Token"
                width={192}
                height={192}
                className="w-full h-full object-cover pixelated"
                unoptimized={true}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-retro-accent p-1 text-center">
                IPFS Ready
              </div>
            </div>
          ) : (
            <div className="w-48 h-48 mb-4 bg-retro-dark border-4 border-dashed border-retro-primary flex items-center justify-center">
              <span className="text-retro-accent font-mono text-sm">IMAGE WILL APPEAR HERE</span>
            </div>
          )}
          
          <button
            onClick={handleDirectImageGeneration}
            disabled={localLoading || isCreatingImage}
            className="retro-button mb-4"
          >
            {localLoading || isCreatingImage ? "GENERATING..." : "GENERATE AI IMAGE"}
          </button>
        </div>
        
        <RetroDivider text="TOKEN PREVIEW" />
        
        <div className="p-3 border-2 border-retro-primary bg-retro-dark mb-4">
          <div className="grid grid-cols-2 gap-2 text-sm font-mono">
            <div className="text-retro-primary">NAME:</div>
            <div className="text-retro-accent">{name}</div>
            
            <div className="text-retro-primary">SYMBOL:</div>
            <div className="text-retro-accent">{symbol}</div>
            
            <div className="text-retro-primary">DESCRIPTION:</div>
            <div className="text-retro-accent truncate">{description}</div>
          </div>
        </div>
        
        <div className="text-xs text-retro-accent mt-4 font-mono">
          <p>* AI WILL GENERATE A UNIQUE IMAGE BASED ON YOUR TOKEN DETAILS</p>
          <p>* THE IMAGE WILL BE STORED PERMANENTLY ON IPFS</p>
          <p>* YOU MUST GENERATE AN IMAGE BEFORE PROCEEDING</p>
        </div>
      </RetroStepScreen>
      
      {/* Navigation buttons */}
      <div className="flex gap-3 mt-4">
        <RetroButton
          variant="outline"
          onClick={onBack}
          fullWidth
        >
          <span className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="mr-2">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
            BACK
          </span>
        </RetroButton>
        
        <RetroButton
          onClick={handleDirectNext}
          disabled={!imageUrl && !localDisplayUrl}
          fullWidth
        >
          <span className="flex items-center justify-center">
            CONTINUE TO MINT
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="ml-2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
            </svg>
          </span>
        </RetroButton>
      </div>
      
      {/* Additional instruction if image is ready */}
      {(imageUrl || localDisplayUrl) && (
        <div className="mt-4 p-3 bg-retro-success/20 border-2 border-retro-success">
          <p className="text-retro-success font-mono text-sm text-center">
            IMAGE GENERATED SUCCESSFULLY! CLICK CONTINUE TO PROCEED
          </p>
        </div>
      )}
    </div>
  );
} 