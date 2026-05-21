import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: Route;
}

export function FeatureCard({ title, description, icon: Icon, href }: FeatureCardProps) {
  const content = (
    <article
      className={
        "rounded-lg border border-white/10 bg-card/80 p-4 shadow-lg shadow-black/20 transition-transform " +
        "hover:translate-y-[-4px] hover:shadow-2xl"
      }
      role={href ? "button" : undefined}
    >
      <div className="bg-primary/12 mb-4 flex size-11 items-center justify-center rounded-md text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-card-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </article>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={title}
      >
        {content}
      </Link>
    );
  }

  return content;
}
