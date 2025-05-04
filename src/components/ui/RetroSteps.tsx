import React from "react";
import { cn } from "../../lib/utils";

export interface RetroStepsProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function RetroSteps({ steps, currentStep, className }: RetroStepsProps) {
  return (
    <div className={cn("retro-step-indicator", className)}>
      {steps.map((stepLabel, index) => (
        <div key={index} className="flex flex-col items-center px-2">
          <div 
            className={cn(
              "retro-step", 
              currentStep === index ? "active" : "",
              currentStep > index ? "completed" : ""
            )}
          >
            {currentStep > index ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              index + 1
            )}
          </div>
          <span className="mt-2 text-xs font-mono text-retro-accent text-center ">
            {stepLabel}
          </span>
        </div>
      ))}
    </div>
  );
} 