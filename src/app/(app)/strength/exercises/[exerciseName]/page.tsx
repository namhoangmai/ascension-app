import { ExerciseDetailClient } from "@/components/strength/strength-tracking-client";
import { deslugifyExerciseName } from "@/features/strength/client-store";

interface ExerciseDetailPageProps {
  params: Promise<{
    exerciseName: string;
  }>;
}

export default async function ExerciseDetailPage({ params }: ExerciseDetailPageProps) {
  const { exerciseName } = await params;

  return <ExerciseDetailClient exerciseName={deslugifyExerciseName(exerciseName)} />;
}
