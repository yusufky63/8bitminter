import React from "react";
import { cn } from "../lib/utils";

interface RetroNotificationProps {
  message: string;
  type: "error" | "success";
  className?: string;
}

export function RetroNotification({
  message,
  type,
  className,
}: RetroNotificationProps) {
  if (!message) return null;

  return (
    <div
      className={cn(
        "retro-notification",
        type === "error" ? "error" : "success",
        className
      )}
    >
      <div className="flex items-start">
        {type === "error" ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
            className="mr-2 flex-shrink-0 mt-0.5"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
            className="mr-2 flex-shrink-0 mt-0.5"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        )}
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
}
