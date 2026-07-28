import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-[#2f463f] bg-[#101b18] px-3 py-2 text-sm text-white outline-none transition placeholder:text-[#7c9189] focus:border-[#3fe0a5]",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
