import React from "react";
import { cn } from "../lib/utils";
import { RetroButton } from "./ui/RetroButton";

export interface RetroStepScreenProps {
  children: React.ReactNode;
  title?: string;
  onNext?: () => void;
  onBack?: () => void;
  nextText?: string;
  backText?: string;
  isNextLoading?: boolean;
  isNextDisabled?: boolean;
  hideButtons?: boolean;
  className?: string;
}

export function RetroStepScreen({
  children,
  title,
  onNext,
  onBack,
  nextText = "NEXT",
  backText = "BACK",
  isNextLoading = false,
  isNextDisabled = false,
  hideButtons = false,
  className,
}: RetroStepScreenProps) {
  return (
    <div className={cn("crt-effect retro-container mb-6", className)}>
      {title && (
        <div className="retro-card-header mb-5 pb-2 border-b-2 border-retro-primary">
          {title}
        </div>
      )}
      
      <div className="mb-4">{children}</div>
      
      {!hideButtons && (
        <div className="flex gap-3 mt-5">
          {onBack && (
            <RetroButton
              variant="outline"
              onClick={onBack}
              fullWidth
            >
              <span className="flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  className="mr-2"
                >
                  <path d="M19 12H5"></path>
                  <path d="M12 19l-7-7 7-7"></path>
                </svg>
                {backText}
              </span>
            </RetroButton>
          )}
          
          {onNext && (
            <RetroButton
              onClick={onNext}
              isLoading={isNextLoading}
              disabled={isNextDisabled}
              fullWidth
              data-next-step="true"
            >
              <span className="flex items-center justify-center">
                {!isNextLoading && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    className="ml-2 order-2"
                  >
                    <path d="M5 12h14"></path>
                    <path d="M12 5l7 7-7 7"></path>
                  </svg>
                )}
                <span className="order-1">{nextText}</span>
              </span>
            </RetroButton>
          )}
        </div>
      )}
    </div>
  );
} 