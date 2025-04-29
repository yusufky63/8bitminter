import { cn } from "~/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({ 
  children, 
  className = "", 
  isLoading = false, 
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  ...props 
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none";
  
  const variantStyles = {
    primary: "bg-primary text-white hover:bg-primary-dark",
    secondary: "bg-gray-light hover:bg-gray-mid text-foreground",
    outline: "border border-gray-mid bg-transparent hover:bg-gray-light text-foreground",
    ghost: "bg-transparent hover:bg-gray-light text-foreground",
  };
  
  const sizeStyles = {
    sm: "text-sm py-1.5 px-3",
    md: "text-base py-2.5 px-5",
    lg: "text-lg py-3 px-6",
  };
  
  const widthStyles = fullWidth ? "w-full" : "";
  
  return (
    <button
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        widthStyles,
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full mr-2" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
}
