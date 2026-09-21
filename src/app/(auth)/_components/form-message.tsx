import { CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FormMessageProps {
  tone: "error" | "success";
  children: ReactNode;
  className?: string;
}

/** Monochrome status message: meaning is carried by icon + weight, not color. */
export function FormMessage({ tone, children, className }: FormMessageProps) {
  const Icon = tone === "success" ? CircleCheck : CircleAlert;

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "animate-fade-in flex items-start gap-2 text-sm",
        tone === "error" ? "font-semibold text-foreground" : "font-medium text-foreground",
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
