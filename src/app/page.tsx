"use client";

import { useEffect } from "react";
import App from "./app";
import { initializeFarcaster } from "./mini-app";

export default function Home() {
  useEffect(() => {
    // Dokümantasyona göre interface hazır olduğunda splash screen'i kapat
    initializeFarcaster();
  }, []);

  return <App />;
}
