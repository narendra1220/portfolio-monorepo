import * as React from "react";
import { cn } from "./cn";

export function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 shadow-inner",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
