import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function FeatureCard({ title, description, icon: Icon }: FeatureCardProps) {
  return (
    <article className="rounded-lg border border-white/10 bg-card/80 p-4 shadow-lg shadow-black/20">
      <div className="bg-primary/12 mb-4 flex size-11 items-center justify-center rounded-md text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-card-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </article>
  );
}
