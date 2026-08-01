import { Circle } from "lucide-react";
import type { ConnectionStatus } from "@/lib/types";
const styles: Record<ConnectionStatus, string> = {
  live: "text-emerald-400",
  connecting: "text-amber-400",
  polling: "text-sky-400",
  offline: "text-rose-400",
};
export function ConnectionStatus({ status }: { status: ConnectionStatus }) {
  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-medium ${styles[status]}`}
    >
      <Circle aria-hidden="true" size={8} fill="currentColor" />{" "}
      {status === "live"
        ? "Live stream"
        : status === "polling"
          ? "Polling fallback"
          : status === "connecting"
            ? "Connecting"
            : "Offline or stale"}
    </span>
  );
}
