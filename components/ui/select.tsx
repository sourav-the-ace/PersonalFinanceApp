import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-[#2f463f] bg-[#101b18] px-3 py-2 text-sm text-white outline-none transition placeholder:text-[#7c9189] focus:border-[#3fe0a5]",
        className,
      )}
      {...props}
    />
  );
});
Select.displayName = "Select";

export { Select };
