import * as React from "react";
import { cn } from "./cn";

export function GradientText({
  children,
  className,
  from = "from-cyan-300",
  via = "via-sky-400",
  to = "to-violet-400",
}: {
  children: React.ReactNode;
  className?: string;
  from?: string;
  via?: string;
  to?: string;
}) {
  return (
    <span
      className={cn(
        "bg-clip-text text-transparent bg-gradient-to-r",
        from,
        via,
        to,
        className,
      )}
    >
      {children}
    </span>
  );
}
