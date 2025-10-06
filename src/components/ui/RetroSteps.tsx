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
      {steps.map((stepLabel, index) => {
        const isActive = currentStep === index;
        const isCompleted = currentStep > index;
        const showConnector = index < steps.length - 1;
        const connectorCompleted = currentStep > index; // if we've reached the next step

        return (
          <React.Fragment key={index}>
            <div className="flex flex-col items-center mx-2">
              <div
                className={cn(
                  "retro-step",
                  isActive ? "active" : "",
                  isCompleted ? "completed" : ""
                )}
              >
                {isCompleted ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span className=" text-[10px] font-mono text-retro-accent text-center">
                {stepLabel}
              </span>
            </div>
            {showConnector && (
              <div
                className={cn(
                  "retro-step-connector",
                  connectorCompleted ? "completed" : ""
                )}
                aria-hidden
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
} 
