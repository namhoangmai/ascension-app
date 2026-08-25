import { StrengthTrackingClient } from "@/components/strength/strength-tracking-client";
import { listStrengthWorkouts } from "@/features/strength/server";

export default async function StrengthPage() {
  const workouts = await listStrengthWorkouts();

  return <StrengthTrackingClient initialWorkouts={workouts} />;
}
