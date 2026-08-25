import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  href?: Route;
}

export function StatTile({ icon: Icon, label, value, sub, progress, href }: StatTileProps) {
  const content = (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-xl border border-white/10 bg-card/80 p-4 shadow-md shadow-black/10 transition-colors",
        href ? "hover:border-primary/30 hover:bg-card" : undefined
      )}
    >
      <div className="flex items-center justify-between">
        <span className="bg-primary/12 grid size-9 place-items-center rounded-lg text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div>
        <p className="text-xl font-semibold leading-tight text-card-foreground">{value}</p>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      {typeof progress === "number" ? (
        <div className="mt-auto h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${String(Math.min(Math.max(progress, 0), 100))}%` }}
          />
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${label}: ${value}`}
      >
        {content}
      </Link>
    );
  }

  return content;
}
