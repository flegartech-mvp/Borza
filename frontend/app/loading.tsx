import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh max-w-7xl space-y-6 px-4 py-8" aria-label="Loading Borza Academy" role="status">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-48 w-full" radius="lg" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </main>
  );
}
