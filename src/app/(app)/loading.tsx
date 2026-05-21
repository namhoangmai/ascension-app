export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-44 animate-pulse rounded-md bg-white/10" />
      <div className="h-24 animate-pulse rounded-lg bg-white/10" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-36 animate-pulse rounded-lg bg-white/10" />
        <div className="h-36 animate-pulse rounded-lg bg-white/10" />
      </div>
    </div>
  );
}
