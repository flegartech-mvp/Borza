"use client";

import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  createTextWatermark,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { usePreferences } from "@/features/preferences";
import type { DemoCandle } from "@/lib/academy-types";

type ChartMarker = { time: number; side: "entry" | "exit"; label: string };

function movingAverage(candles: DemoCandle[], period: number) {
  return candles.flatMap((candle, index) => {
    if (index < period - 1) return [];
    let total = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) total += candles[cursor].close;
    return [{ time: candle.time as UTCTimestamp, value: total / period }];
  });
}

function volumeWeightedAverage(candles: DemoCandle[]) {
  let priceVolume = 0;
  let volume = 0;
  return candles.map((candle) => {
    priceVolume += ((candle.high + candle.low + candle.close) / 3) * candle.volume;
    volume += candle.volume;
    return { time: candle.time as UTCTimestamp, value: priceVolume / volume };
  });
}

export type MarketChartProps = {
  candles: DemoCandle[];
  markers?: ChartMarker[];
  stop?: number;
  target?: number;
  support?: number;
  resistance?: number;
  label: string;
};

const chartCopy = {
  de: { watermark: "SIMULIERT", stop: "STOP", target: "ZIEL", support: "SUPPORT", resistance: "RESISTANCE", visible: "sichtbare Kerzen", changed: "Preisänderung im sichtbaren simulierten Fenster", overlays: "Blau zeigt den 8-Perioden-Durchschnitt, Amber den VWAP.", powered: "Chart-Technik von" },
  sl: { watermark: "SIMULIRANO", stop: "STOP", target: "CILJ", support: "PODPORA", resistance: "ODPOR", visible: "vidnih sveč", changed: "sprememba cene v vidnem simuliranem oknu", overlays: "Modra prikazuje 8-obdobno povprečje, jantarna VWAP.", powered: "Tehnologija grafa" },
  en: { watermark: "SIMULATED", stop: "STOP", target: "TARGET", support: "SUPPORT", resistance: "RESISTANCE", visible: "visible candles", changed: "price change across the visible simulated window", overlays: "Blue is the 8-period moving average; amber is VWAP.", powered: "Chart technology by" },
};

export function MarketChart({ candles, markers = [], stop, target, support, resistance, label }: MarketChartProps) {
  const { resolvedTheme, language } = usePreferences();
  const copy = chartCopy[language];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markerRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const linesRef = useRef<Array<{ remove: () => void }>>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const styles = getComputedStyle(document.documentElement);
    const chart = createChart(container, {
      autoSize: true,
      height: 440,
      layout: {
        background: { type: ColorType.Solid, color: styles.getPropertyValue("--surface-1").trim() },
        textColor: styles.getPropertyValue("--text-secondary").trim(),
        fontFamily: "var(--font-geist-mono)",
      },
      grid: {
        vertLines: { color: styles.getPropertyValue("--chart-grid").trim() },
        horzLines: { color: styles.getPropertyValue("--chart-grid").trim() },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: styles.getPropertyValue("--border-subtle").trim() },
      rightPriceScale: { borderColor: styles.getPropertyValue("--border-subtle").trim() },
      crosshair: { vertLine: { labelVisible: false } },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: styles.getPropertyValue("--chart-up").trim(),
      downColor: styles.getPropertyValue("--chart-down").trim(),
      wickUpColor: styles.getPropertyValue("--chart-up").trim(),
      wickDownColor: styles.getPropertyValue("--chart-down").trim(),
      borderVisible: false,
    }, 0);
    const maSeries = chart.addSeries(LineSeries, { color: styles.getPropertyValue("--electric").trim(), lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 0);
    const vwapSeries = chart.addSeries(LineSeries, { color: styles.getPropertyValue("--warning").trim(), lineWidth: 2, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }, 0);
    const volumeSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false }, 1);
    chart.panes()[1]?.setHeight(105);
    createTextWatermark(chart.panes()[0], { horzAlign: "center", vertAlign: "center", lines: [{ text: copy.watermark, color: "rgba(128,145,160,0.14)", fontSize: 28 }] });
    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;
    maRef.current = maSeries;
    vwapRef.current = vwapSeries;
    markerRef.current = createSeriesMarkers(candleSeries, []);
    return () => {
      linesRef.current = [];
      markerRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      maRef.current = null;
      vwapRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [copy.watermark, resolvedTheme]);

  useEffect(() => {
    const candleSeries = candleRef.current;
    if (!candleSeries || !chartRef.current) return;
    candleSeries.setData(candles.map(({ time, open, high, low, close }) => ({ time: time as UTCTimestamp, open, high, low, close })));
    volumeRef.current?.setData(candles.map((candle) => ({ time: candle.time as UTCTimestamp, value: candle.volume, color: candle.close >= candle.open ? "rgba(82,206,162,.45)" : "rgba(237,114,114,.45)" })));
    maRef.current?.setData(movingAverage(candles, 8));
    vwapRef.current?.setData(volumeWeightedAverage(candles));
    markerRef.current?.setMarkers(markers.map((marker) => ({ time: marker.time as UTCTimestamp, position: marker.side === "entry" ? "belowBar" : "aboveBar", shape: marker.side === "entry" ? "arrowUp" : "arrowDown", color: marker.side === "entry" ? "#52cea2" : "#ed7272", text: marker.label })));
    linesRef.current.forEach((line) => line.remove());
    linesRef.current = [];
    if (stop !== undefined) {
      const line = candleSeries.createPriceLine({ price: stop, color: "#ed7272", lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: copy.stop });
      linesRef.current.push({ remove: () => candleSeries.removePriceLine(line) });
    }
    if (target !== undefined) {
      const line = candleSeries.createPriceLine({ price: target, color: "#52cea2", lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: copy.target });
      linesRef.current.push({ remove: () => candleSeries.removePriceLine(line) });
    }
    if (support !== undefined) {
      const line = candleSeries.createPriceLine({ price: support, color: "#52cea2", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: copy.support });
      linesRef.current.push({ remove: () => candleSeries.removePriceLine(line) });
    }
    if (resistance !== undefined) {
      const line = candleSeries.createPriceLine({ price: resistance, color: "#f0b85a", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: copy.resistance });
      linesRef.current.push({ remove: () => candleSeries.removePriceLine(line) });
    }
    chartRef.current.timeScale().fitContent();
  }, [candles, copy.resistance, copy.stop, copy.support, copy.target, markers, resistance, resolvedTheme, stop, support, target]);

  const last = candles.at(-1);
  const first = candles[0];
  const change = first && last ? ((last.close - first.open) / first.open) * 100 : 0;
  return (
    <figure aria-label={label} className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)]">
      <div ref={containerRef} className="h-[440px] min-w-0" />
      <figcaption className="border-t border-[var(--border-subtle)] px-4 py-3 text-xs leading-5 text-[var(--text-secondary)]">
        {label}. {candles.length} {copy.visible}; {copy.changed}: {change.toFixed(1)}%. {copy.overlays}{" "}
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--brand)] underline decoration-transparent underline-offset-2 hover:decoration-current">{copy.powered} TradingView Lightweight Charts™</a>.
      </figcaption>
    </figure>
  );
}
