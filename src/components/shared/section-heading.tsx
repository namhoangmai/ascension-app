interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description: string;
}

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="space-y-2">
      {eyebrow ? <p className="text-sm font-medium text-primary">{eyebrow}</p> : null}
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
