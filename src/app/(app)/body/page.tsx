import { Scale } from "lucide-react";

import { FeatureCard } from "@/components/shared/feature-card";
import { SectionHeading } from "@/components/shared/section-heading";

export default function BodyPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Phase 9"
        title="Body progress"
        description="Weight trends, measurements, and private progress photos will live here once secure storage is wired."
      />
      <FeatureCard
        icon={Scale}
        title="Progress history"
        description="Body metrics are timestamped, with flexible named measurements for standard and custom tracking."
      />
    </div>
  );
}
