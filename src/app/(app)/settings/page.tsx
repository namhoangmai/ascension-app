import { Settings } from "lucide-react";

import { FeatureCard } from "@/components/shared/feature-card";
import { SectionHeading } from "@/components/shared/section-heading";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Phase 2+"
        title="Settings"
        description="Account, units, rest preferences, nutrition goals, and security controls will be added after authentication."
      />
      <FeatureCard
        icon={Settings}
        title="Preference model"
        description="Default rest time, weight increments, unit system, and preferred meal types are represented in the database."
      />
    </div>
  );
}
