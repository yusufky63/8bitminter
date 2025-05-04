import React from "react";
import { cn } from "../../lib/utils";

export interface RetroSelectOption {
  value: string;
  label: string;
}

export interface RetroSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: RetroSelectOption[];
  label?: string;
  error?: string;
  onChange?: (value: string) => void;
}

const RetroSelect = React.forwardRef<HTMLSelectElement, RetroSelectProps>(
  ({ className, label, error, options, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onChange) {
        onChange(e.target.value);
      }
    };

    return (
      <div className="mb-4">
        {label && (
          <label className="retro-label mb-2 block">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            className={cn(
              "retro-select w-full",
              error && "border-retro-error",
              className
            )}
            onChange={handleChange}
            ref={ref}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="mt-1 text-sm text-retro-error font-mono">{error}</p>
        )}
      </div>
    );
  }
);

RetroSelect.displayName = "RetroSelect";

export { RetroSelect }; 