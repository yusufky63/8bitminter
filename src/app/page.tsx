"use client";

import { useEffect, useState } from "react";
import App from "./app";
import { FrameContext, initializeFarcaster } from "./mini-app";

export default function Home() {
  const [context, setContext] = useState<FrameContext | null>(null);
  const [safeAreaInsets, setSafeAreaInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });

  useEffect(() => {
    const initFarcaster = async () => {
      try {
        // Initialize Farcaster when the interface is ready
        const contextData = await initializeFarcaster();
        
        if (contextData) {
          setContext(contextData);
          
          // Set safe area insets if available
          if (contextData.client?.safeAreaInsets) {
            setSafeAreaInsets(contextData.client.safeAreaInsets);
          }
          
          // Check if we have notification permissions
          if (contextData.client?.notificationDetails) {
            console.log("Notification details available:", !!contextData.client.notificationDetails);
          }
          
          // Check manifest access to verify setup
          try {
            const response = await fetch('/.well-known/farcaster.json');
            console.log('Manifest access status:', response.status, response.statusText);
            
            if (response.ok) {
              const data = await response.json();
              console.log('Manifest has webhook URL:', !!data.frame.webhookUrl);
            } else {
              console.error('Manifest access error status:', response.status);
            }
          } catch (error) {
            console.error('Error accessing manifest:', error);
          }
        }
      } catch (error) {
        console.error("Error initializing Farcaster:", error);
      }
    };

    initFarcaster();
  }, []);

  return (
    <div style={{
      marginTop: safeAreaInsets.top,
      marginBottom: safeAreaInsets.bottom,
      marginLeft: safeAreaInsets.left,
      marginRight: safeAreaInsets.right,
    }}>
      <App 
        isMiniApp={!!context} 
        userName={context?.user?.username || context?.user?.displayName || 'User'}
        userFid={context?.user?.fid}
      />
    </div>
  );
}
