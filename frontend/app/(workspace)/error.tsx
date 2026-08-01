"use client";

import { Button, ErrorState } from "@/components/ui";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="This workspace could not be displayed"
      description="Retry the route. If the problem continues, verify the frontend and API configuration."
      action={<Button onClick={reset}>Retry workspace</Button>}
    />
  );
}
