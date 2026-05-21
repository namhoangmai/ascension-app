import { Dumbbell } from "lucide-react";

import { FeatureCard } from "@/components/shared/feature-card";
import { SectionHeading } from "@/components/shared/section-heading";

export default function WorkoutsPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Phase 3"
        title="Workout system"
        description="Programs, scheduled days, exercise library, and custom exercises will attach to the Phase 1 schema here."
      />
      <FeatureCard
        icon={Dumbbell}
        title="Schema ready"
        description="Planning tables and logging tables are separated so workout setup stays clean while active logging stays fast."
      />
    </div>
  );
}
