"use client";

import { Check, X } from "lucide-react";

import { passwordRequirements } from "@/lib/auth/password-requirements";
import { cn } from "@/lib/utils";

interface PasswordRequirementsProps {
  password: string;
}

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  return (
    <div aria-live="polite">
      <ul className="space-y-1 text-sm">
        {passwordRequirements.map((requirement) => {
          const met = requirement.test(password);

          return (
            <li
              key={requirement.id}
              className={cn(
                "flex items-center gap-2 transition-colors",
                met ? "text-primary" : "text-muted-foreground"
              )}
            >
              {met ? (
                <Check className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <X className="size-3.5 shrink-0" aria-hidden="true" />
              )}
              {requirement.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
