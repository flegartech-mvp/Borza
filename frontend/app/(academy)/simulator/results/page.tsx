import { Suspense } from "react";
import { SimulatorResults } from "@/features/simulator/results";
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="h-72 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-2)]" />
      }
    >
      <SimulatorResults />
    </Suspense>
  );
}
