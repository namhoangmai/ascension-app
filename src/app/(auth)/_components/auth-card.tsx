import type { ReactNode } from "react";

interface AuthCardProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthCard({ eyebrow, title, description, children }: AuthCardProps) {
  return (
    <section className="glass-panel animate-rise-in w-full rounded-3xl p-6 sm:p-10">
      <div className="mb-8 space-y-3 text-center">
        <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        <h1 className="text-title">{title}</h1>
        <p className="text-base leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
