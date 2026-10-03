"use client";

import { Settings } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface SettingsVisibilityContextValue {
  open: boolean;
  toggle: () => void;
}

/**
 * The "Settings" toggle button lives inside the hero card while the panel it reveals renders right
 * after the card — both are small client islands around otherwise server-rendered markup, so they
 * share open/closed state via context rather than lifting state into the (server) page component.
 */
const SettingsVisibilityContext = createContext<SettingsVisibilityContextValue | null>(null);

export function SettingsVisibilityProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <SettingsVisibilityContext.Provider
      value={{
        open,
        toggle: () => {
          setOpen((value) => !value);
        }
      }}
    >
      {children}
    </SettingsVisibilityContext.Provider>
  );
}

function useSettingsVisibility() {
  const context = useContext(SettingsVisibilityContext);

  if (!context) {
    throw new Error("useSettingsVisibility must be used within a SettingsVisibilityProvider");
  }

  return context;
}

export function SettingsToggleButton() {
  const { open, toggle } = useSettingsVisibility();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggle}
      aria-expanded={open}
      aria-controls={open ? "profile-settings-panel" : undefined}
    >
      <Settings className="size-4" aria-hidden="true" />
      Settings
    </Button>
  );
}

export function SettingsVisibilityGate({ children }: { children: ReactNode }) {
  const { open } = useSettingsVisibility();

  if (!open) {
    return null;
  }

  return <>{children}</>;
}
