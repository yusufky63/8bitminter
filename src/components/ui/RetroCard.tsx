import React from "react";
import { cn } from "../../lib/utils";

export interface RetroCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  icon?: React.ReactNode;
}

const RetroCard = React.forwardRef<HTMLDivElement, RetroCardProps>(
  ({ className, title, icon, children, ...props }, ref) => {
    return (
      <div
        className={cn("retro-card", className)}
        ref={ref}
        {...props}
      >
        {title && (
          <div className="retro-card-header">
            {icon && <span className="mr-2">{icon}</span>}
            <span>{title}</span>
          </div>
        )}
        <div>{children}</div>
      </div>
    );
  }
);

RetroCard.displayName = "RetroCard";

export { RetroCard }; 