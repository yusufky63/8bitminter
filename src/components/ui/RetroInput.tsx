import React from "react";
import { cn } from "../../lib/utils";

export interface RetroInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const RetroInput = React.forwardRef<HTMLInputElement, RetroInputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="mb-4">
        {label && (
          <label className="retro-label mb-2 block">
            {label}
          </label>
        )}
        <input
          className={cn(
            "retro-input w-full",
            error && "border-retro-error",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-retro-error font-mono">{error}</p>
        )}
      </div>
    );
  }
);

RetroInput.displayName = "RetroInput";

export { RetroInput }; 