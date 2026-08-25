import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: Route;
}

export function FeatureCard({ title, description, icon: Icon, href }: FeatureCardProps) {
  const content = (
    <article
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/80 p-5 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-2xl"
      role={href ? "button" : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="bg-primary/12 grid size-11 place-items-center rounded-xl text-primary transition-colors group-hover:bg-primary/20">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        {href ? (
          <ArrowUpRight
            className="size-4 text-muted-foreground opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <h2 className="mt-4 text-base font-semibold text-card-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </article>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={title}
      >
        {content}
      </Link>
    );
  }

  return content;
}
