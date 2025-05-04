import React from "react";
import { cn } from "../../lib/utils";

export interface RetroTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const RetroTextarea = React.forwardRef<HTMLTextAreaElement, RetroTextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="mb-4">
        {label && (
          <label className="retro-label mb-2 block">
            {label}
          </label>
        )}
        <textarea
          className={cn(
            "retro-input w-full min-h-[100px] resize-y",
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

RetroTextarea.displayName = "RetroTextarea";

export { RetroTextarea }; 