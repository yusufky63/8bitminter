import React from "react";
import { cn } from "../lib/utils";

interface RetroDividerProps {
  text?: string;
  className?: string;
}

export function RetroDivider({ text, className }: RetroDividerProps) {
  if (!text) {
    return <div className={cn("h-1 w-full bg-retro-primary my-3", className)} />;
  }
  
  return (
    <div className={cn("flex items-center my-3", className)}>
      <div className="h-0.5 flex-1 bg-retro-primary"></div>
      <span className="px-3 font-mono text-retro-primary text-sm uppercase tracking-widest">
        {text}
      </span>
      <div className="h-0.5 flex-1 bg-retro-primary"></div>
    </div>
  );
} 