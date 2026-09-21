interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description: string;
}

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="animate-rise-in space-y-3">
      {eyebrow ? <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p> : null}
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{title}</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {description}
        </p>
      </div>
    </div>
  );
}
