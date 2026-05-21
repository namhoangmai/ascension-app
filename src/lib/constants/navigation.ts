import { Activity, BarChart3, Dumbbell, Scale, Settings, Utensils } from "lucide-react";

export const primaryNavigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: Activity
  },
  {
    label: "Workouts",
    href: "/workouts",
    icon: Dumbbell
  },
  {
    label: "Nutrition",
    href: "/nutrition",
    icon: Utensils
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
