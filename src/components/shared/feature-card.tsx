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
      className="hover-lift group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card p-6 transition-colors hover:border-foreground/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/40"
      role={href ? "button" : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="grid size-11 place-items-center rounded-2xl bg-foreground text-background">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        {href ? (
          <ArrowUpRight
            className="size-4 text-muted-foreground opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground group-hover:opacity-100 motion-reduce:transition-none"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-card-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </article>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="press block h-full cursor-pointer rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={title}
      >
        {content}
      </Link>
    );
  }

  return content;
}
