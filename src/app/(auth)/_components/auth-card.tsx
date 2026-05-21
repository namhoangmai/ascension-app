import type { ReactNode } from "react";

interface AuthCardProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthCard({ eyebrow, title, description, children }: AuthCardProps) {
  return (
    <section className="glass-panel w-full rounded-lg p-5">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
