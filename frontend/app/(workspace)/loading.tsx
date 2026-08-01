import { Skeleton, Surface } from "@/components/ui";

export default function WorkspaceLoading() {
  return (
    <div aria-label="Loading workspace" role="status">
      <div className="max-w-3xl space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-5 w-[560px] max-w-full" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Surface key={index} padding="md">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-7 w-16" />
          </Surface>
        ))}
      </div>
      <Skeleton className="mt-5 h-[420px] w-full" radius="lg" />
    </div>
  );
}
