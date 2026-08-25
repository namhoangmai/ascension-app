"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ChangeEvent } from "react";

import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  name: string;
  type?: "email" | "password" | "text";
  autoComplete?: string;
  placeholder?: string;
  error?: string[] | undefined;
  defaultValue?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}

export function FormField({
  label,
  name,
  type = "text",
  autoComplete,
  placeholder,
  error,
  defaultValue,
  value,
  onChange,
  required
}: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;
  const isControlled = value !== undefined;

  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="relative block">
        <input
          name={name}
          type={inputType}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          onChange={onChange}
          {...(isControlled ? { value } : { defaultValue })}
          className={cn(
            "h-12 w-full rounded-md border border-white/10 bg-white/[0.06] px-3 text-base text-foreground outline-none transition",
            "placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-primary/20",
            isPassword ? "pr-12" : ""
          )}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => {
              setShowPassword((value) => !value);
            }}
            className="hover:bg-white/8 absolute right-1 top-1 inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </span>
      {error?.length ? <p className="text-sm text-destructive">{error[0]}</p> : null}
    </label>
  );
}
