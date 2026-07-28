import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const base = "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
    const variants = {
      default: "bg-[#3fe0a5] text-[#101b18] hover:bg-[#36c692]",
      outline: "border border-[#2f463f] bg-transparent text-white hover:bg-[#1b2b24]",
      ghost: "text-white hover:bg-[#1b2b24]",
    };

    return <button ref={ref} className={cn(base, variants[variant], className)} {...props} />;
  },
);
Button.displayName = "Button";

export { Button };
