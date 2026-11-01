import * as React from "react";
import { cn } from "../../lib/utils";

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        orientation === "horizontal"
          ? "h-px w-full bg-white/10"
          : "h-full w-px bg-white/10",
        className
      )}
      {...props}
    />
  );
}

export { Separator };