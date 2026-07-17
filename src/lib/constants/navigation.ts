import { Activity, BarChart3, Bot, Dumbbell, Scale, Settings, Utensils } from "lucide-react";

export const primaryNavigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: Activity
  },
  {
    label: "Strength",
    href: "/strength",
    icon: Dumbbell
  },
  {
    label: "Nutrition",
    href: "/nutrition",
    icon: Utensils
  },
  {
    label: "AI Coach",
    href: "/ai-coach",
    icon: Bot
  },
  {
    label: "Body",
    href: "/body",
    icon: Scale
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings
  }
] as const;
