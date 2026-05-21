import { BarChart3 } from "lucide-react";

import { FeatureCard } from "@/components/shared/feature-card";
import { SectionHeading } from "@/components/shared/section-heading";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Phase 10"
        title="Analytics"
        description="Workout volume, PRs, overload history, macro adherence, and body trends will be computed from indexed source tables."
      />
      <FeatureCard
        icon={BarChart3}
        title="Derived first"
        description="Analytics start from normalized source data before introducing summary tables."
      />
    </div>
  );
}
