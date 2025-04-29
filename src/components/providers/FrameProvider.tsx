"use client";

import { useEffect, useState, useCallback } from "react";
// SDK'yı doğrudan import etmek yerine dinamik olarak yükleyeceğiz
import { createStore } from "mipd";
import React from "react";

// SDK türleri için minimum gerekli tanımları ekleyelim (bunlar tipik SDK yapısını yansıtır)
interface FrameNotificationDetails {
  url: string;
  token: string;
}

interface FrameContext {
  user?: {
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
  client?: {
    clientFid?: number;
    added?: boolean;
    safeAreaInsets?: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
    notificationDetails?: FrameNotificationDetails;
  };
}

class SDKError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

class RejectedByUser extends SDKError {}
class InvalidDomainManifest extends SDKError {}

const AddFrame = {
  RejectedByUser,
  InvalidDomainManifest
};

interface FrameContextType {
  isSDKLoaded: boolean;
  context: FrameContext | undefined;
}

const FrameContext = React.createContext<FrameContextType | undefined>(undefined);

export function useFrame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [sdkInstance, setSdkInstance] = useState<any>(null);
  const [context, setContext] = useState<FrameContext>();
  const [added, setAdded] = useState(false);
  const [notificationDetails, setNotificationDetails] = useState<FrameNotificationDetails | null>(null);
  const [lastEvent, setLastEvent] = useState("");
  const [addFrameResult, setAddFrameResult] = useState("");

  const addFrame = useCallback(async () => {
    if (!sdkInstance) return;
    
    try {
      setNotificationDetails(null);

      const result = await sdkInstance.actions.addFrame();

      if (result.notificationDetails) {
        setNotificationDetails(result.notificationDetails);
      }
      setAddFrameResult(
        result.notificationDetails
          ? `Added, got notificaton token ${result.notificationDetails.token} and url ${result.notificationDetails.url}`
          : "Added, got no notification details"
      );
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, [sdkInstance]);

  useEffect(() => {
    // Tarayıcı tarafında olduğumuzdan emin ol
    if (typeof window === 'undefined' || isSDKLoaded) return;
    
    const loadSDK = async () => {
      try {
        // SDK'yı dinamik olarak import et
        const { sdk } = await import('@farcaster/frame-sdk');
        setSdkInstance(sdk);
        
        // Context'i al
        try {
          const contextData = await sdk.context;
          setContext(contextData);
          console.log("Farcaster SDK context loaded:", contextData);
        } catch (err) {
          console.warn("Failed to load context:", err);
        }
        
        // Set up event listeners
        sdk.on("frameAdded", ({ notificationDetails }) => {
          console.log("Frame added", notificationDetails);
          setAdded(true);
          setNotificationDetails(notificationDetails ?? null);
          setLastEvent("Frame added");
        });

        sdk.on("frameAddRejected", ({ reason }) => {
          console.log("Frame add rejected", reason);
          setAdded(false);
          setLastEvent(`Frame add rejected: ${reason}`);
        });

        sdk.on("frameRemoved", () => {
          console.log("Frame removed");
          setAdded(false);
          setLastEvent("Frame removed");
        });

        sdk.on("notificationsEnabled", ({ notificationDetails }) => {
          console.log("Notifications enabled", notificationDetails);
          setNotificationDetails(notificationDetails ?? null);
          setLastEvent("Notifications enabled");
        });

        sdk.on("notificationsDisabled", () => {
          console.log("Notifications disabled");
          setNotificationDetails(null);
          setLastEvent("Notifications disabled");
        });

        sdk.on("primaryButtonClicked", () => {
          console.log("Primary button clicked");
          setLastEvent("Primary button clicked");
        });

        // Call ready action
        console.log("Calling ready");
        await sdk.actions.ready({});
        console.log("SDK ready complete");

        // Set up MIPD Store
        const store = createStore();
        store.subscribe((providerDetails) => {
          console.log("PROVIDER DETAILS", providerDetails);
        });
        
        setIsSDKLoaded(true);
        console.log("Farcaster SDK loaded successfully");
      } catch (error) {
        console.error("Failed to load Farcaster SDK:", error);
      }
    };

    console.log("Starting SDK load process");
    loadSDK();
    
    // Cleanup
    return () => {
      if (sdkInstance) {
        sdkInstance.removeAllListeners();
      }
    };
  }, [isSDKLoaded]);

  return { isSDKLoaded, context, added, notificationDetails, lastEvent, addFrame, addFrameResult };
}

export function FrameProvider({ children }: { children: React.ReactNode }) {
  const { isSDKLoaded, context } = useFrame();

  return (
    <FrameContext.Provider value={{ isSDKLoaded, context }}>
      {children}
    </FrameContext.Provider>
  );
} 