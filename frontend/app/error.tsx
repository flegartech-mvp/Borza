"use client";

import { Button, ErrorState } from "@/components/ui";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <ErrorState
        className="w-full max-w-xl"
        title="Borza Academy could not be displayed"
        description="Your local learning data is still stored in this browser. Retry the page to continue."
        action={<Button onClick={reset}>Retry</Button>}
      />
    </main>
  );
}
