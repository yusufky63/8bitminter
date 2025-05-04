import React from "react";
import { cn } from "../../lib/utils";

export interface RetroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline";
  isLoading?: boolean;
  fullWidth?: boolean;
}

const RetroButton = React.forwardRef<HTMLButtonElement, RetroButtonProps>(
  ({ className, variant = "default", isLoading, fullWidth = false, children, ...props }, ref) => {
    return (
      <button
        className={cn(
          variant === "default" ? "retro-button" : "retro-button-outline",
          fullWidth ? "w-full" : "",
          className
        )}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <div className="retro-loading">
            <div></div>
            <div></div>
            <div></div>
          </div>
        ) : (
          children
        )}
      </button>
    );
  }
);

RetroButton.displayName = "RetroButton";

export { RetroButton }; 