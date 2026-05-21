import {
  ownedSavedMealWhere,
  accessibleExerciseWhere,
  accessibleFoodWhere
} from "./access-control";

export const protectedRoutes = [
  "/dashboard",
  "/workouts",
  "/nutrition",
  "/body",
  "/analytics",
  "/settings"
] as const;

export const authRoutes = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password"] as const;

export function isProtectedPath(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isAuthPath(pathname: string) {
  return authRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export { accessibleExerciseWhere, accessibleFoodWhere, ownedSavedMealWhere };
