"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  CloudOff,
  RefreshCw,
} from "lucide-react";
import { getIngestionStatus } from "@/lib/api";
import type { IngestionStatus } from "@/lib/types";
import { summarizeSystemStatus, type SystemStatusTone } from "./status-model";

const toneStyles: Record<SystemStatusTone, string> = {
  loading:
    "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)]",
  current:
    "border-[color-mix(in_srgb,var(--positive)_35%,var(--border-subtle))] bg-[var(--positive-soft)] text-[var(--positive)]",
  degraded:
    "border-[color-mix(in_srgb,var(--warning)_38%,var(--border-subtle))] bg-[var(--warning-soft)] text-[var(--warning)]",
  offline:
    "border-[color-mix(in_srgb,var(--negative)_35%,var(--border-subtle))] bg-[var(--negative-soft)] text-[var(--negative)]",
};

const statusIcons = {
  loading: CircleDashed,
  current: CheckCircle2,
  degraded: AlertTriangle,
  offline: CloudOff,
} as const;

function dateLabel(value: string | null): string {
  if (!value) return "Not available";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed)
    : "Not available";
}

export function SystemStatusControl({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [ingestion, setIngestion] = useState<IngestionStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const online = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await getIngestionStatus();
      setIngestion(next);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const summary = summarizeSystemStatus(ingestion, { failed, online });
  const StatusIcon = statusIcons[summary.tone];

  return (
    <details className="group relative">
      <summary
        className={`flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 text-xs font-semibold transition-colors [&::-webkit-details-marker]:hidden ${toneStyles[summary.tone]}`}
      >
        <StatusIcon
          aria-hidden="true"
          size={14}
          className={summary.tone === "loading" ? "animate-spin" : ""}
        />
        <span className={compact ? "sr-only sm:not-sr-only" : ""}>
          {summary.label}
        </span>
        <ChevronDown
          aria-hidden="true"
          size={13}
          className="transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-[min(340px,calc(100vw-24px))] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-floating)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">{summary.label}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              {summary.detail}
            </p>
          </div>
          <button
            type="button"
            aria-label="Refresh data status"
            title="Refresh data status"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            <RefreshCw
              aria-hidden="true"
              size={15}
              className={refreshing ? "animate-spin" : ""}
            />
          </button>
        </div>
        {ingestion ? (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--border-subtle)] pt-4 text-xs">
            <div>
              <dt className="text-[var(--text-tertiary)]">Provider</dt>
              <dd className="mt-1 font-medium capitalize">
                {ingestion.provider ?? "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-tertiary)]">Worker</dt>
              <dd className="mt-1 font-medium capitalize">
                {ingestion.worker_status ?? "Unknown"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[var(--text-tertiary)]">
                Last successful ingestion
              </dt>
              <dd className="mt-1 font-medium">
                {dateLabel(ingestion.last_successful_at)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-tertiary)]">Coverage</dt>
              <dd className="mt-1 font-medium capitalize">
                {ingestion.status}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-tertiary)]">Inserted</dt>
              <dd className="mt-1 font-mono font-medium tabular-nums">
                {ingestion.records_inserted}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
    </details>
  );
}
