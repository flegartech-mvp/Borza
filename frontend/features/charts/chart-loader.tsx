"use client";

import dynamic from "next/dynamic";
import { usePreferences } from "@/features/preferences";
import type { MarketChartProps } from "./market-chart";

const MarketChart = dynamic(() => import("./market-chart").then((module) => module.MarketChart), {
  ssr: false,
  loading: () => <ChartLoading />,
});

function ChartLoading() {
  const { dictionary } = usePreferences();
  return <div className="grid h-[440px] place-items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-2)]" role="status">{dictionary.common.loading}</div>;
}

export function ChartLoader(props: MarketChartProps) {
  return <MarketChart {...props} />;
}
