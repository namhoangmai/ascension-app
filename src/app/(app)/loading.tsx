export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="h-9 w-48 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
      <div className="h-24 animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-36 animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" />
        <div className="h-36 animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" />
      </div>
    </div>
  );
}
