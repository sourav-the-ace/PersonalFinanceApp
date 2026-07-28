import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(({ className, ...props }, ref) => {
  return (
    <label className="inline-flex cursor-pointer items-center">
      <input ref={ref} type="checkbox" className={cn("peer sr-only", className)} {...props} />
      <span className="h-6 w-11 rounded-full bg-[#2f463f] transition peer-checked:bg-[#3fe0a5]" />
    </label>
  );
});
Switch.displayName = "Switch";

export { Switch };
