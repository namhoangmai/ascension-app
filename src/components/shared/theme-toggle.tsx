"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label =
    theme === null ? "Toggle theme" : isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      suppressHydrationWarning
      className={cn(
        "press inline-flex size-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Sun
        className={cn(
          "size-[1.15rem]",
          theme === null ? "hidden dark:block" : isDark ? "block" : "hidden"
        )}
      />
      <Moon
        className={cn(
          "size-[1.15rem]",
          theme === null ? "block dark:hidden" : isDark ? "hidden" : "block"
        )}
      />
    </button>
  );
}
