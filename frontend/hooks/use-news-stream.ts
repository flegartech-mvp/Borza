"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Filters } from "@/lib/filters";
import {
  apiProblemFrom,
  getAnalysis,
  getIngestionStatus,
  getNewsPage,
  getNewsRevision,
  getStats,
} from "@/lib/api";
import { getWebSocketConfig } from "@/lib/runtime-config";
import {
  createBurstScheduler,
  createEventDedupe,
  mergeArticle,
  parseNewsSocketMessage,
  reconnectDelay,
} from "@/lib/news-stream-utils";
import type {
  AnalysisDataset,
  Article,
  ConnectionStatus,
  EndpointState,
  IngestionStatus,
  NewsPage,
  Stats,
} from "@/lib/types";

export const LIVE_RECONCILIATION_MS = 60_000;
export const FALLBACK_RECONCILIATION_MS = 15_000;

function initialEndpointState<T>(): EndpointState<T> {
  return {
    data: null,
    phase: "idle",
    error: null,
    lastSuccessAt: null,
  };
}

function beginRequest<T>(state: EndpointState<T>): EndpointState<T> {
  return {
    ...state,
    phase: state.data === null ? "loading" : "refreshing",
  };
}

function resolveRequest<T>(state: EndpointState<T>, data: T): EndpointState<T> {
  return {
    ...state,
    data,
    phase: "ready",
    error: null,
    lastSuccessAt: Date.now(),
  };
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function matchesFilters(article: Article, filters: Filters): boolean {
  const search = filters.search.trim().toLowerCase();
  const published = Date.parse(article.published_at);
  return (
    Number.isFinite(published) &&
    published >=
      Date.now() - Number.parseInt(filters.window_hours, 10) * 60 * 60 * 1000 &&
    (!filters.sentiment || article.sentiment === filters.sentiment) &&
    (!filters.ticker ||
      article.tickers.some(
        (ticker) => ticker === filters.ticker.trim().toUpperCase(),
      )) &&
    (!filters.urgency || article.urgency === filters.urgency) &&
    (!filters.minimum_impact ||
      (article.impact_score_base ?? article.impact_score) >=
        Number.parseInt(filters.minimum_impact, 10)) &&
    (!filters.minimum_relevance ||
      (article.relevance_score ?? article.impact_score) >=
        Number.parseInt(filters.minimum_relevance, 10)) &&
    (!filters.category ||
      (article.categories ?? []).includes(filters.category)) &&
    (!filters.source || article.source === filters.source) &&
    (!filters.source_type || article.source_type === filters.source_type) &&
    (!filters.region || article.region?.toLowerCase() === filters.region) &&
    (!filters.language ||
      article.language?.toLowerCase() === filters.language) &&
    (!filters.official_only ||
      ["official", "regulator", "exchange"].includes(
        article.source_type ?? "editorial",
      )) &&
    (!search ||
      article.title.toLowerCase().includes(search) ||
      article.description.toLowerCase().includes(search))
  );
}

export function useNewsStream(filters: Filters) {
  const queryClient = useQueryClient();
  const [feedState, setFeedState] =
    useState<EndpointState<NewsPage>>(initialEndpointState);
  const [analysisState, setAnalysisState] =
    useState<EndpointState<AnalysisDataset>>(initialEndpointState);
  const [statsState, setStatsState] =
    useState<EndpointState<Stats>>(initialEndpointState);
  const [freshnessState, setFreshnessState] =
    useState<EndpointState<IngestionStatus>>(initialEndpointState);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationError, setPaginationError] = useState<ReturnType<
    typeof apiProblemFrom
  > | null>(null);
  const filtersRef = useRef(filters);
  const refreshController = useRef<AbortController | null>(null);
  const pageController = useRef<AbortController | null>(null);
  const seenArticleKeys = useRef(new Set<string>());
  const eventDedupe = useRef(createEventDedupe());
  const requestId = useRef(0);
  const lastRevisionRef = useRef<string | null>(null);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    refreshController.current?.abort();
    pageController.current?.abort();
    setLoadingMore(false);
    setPaginationError(null);
    const controller = new AbortController();
    refreshController.current = controller;
    setFeedState(beginRequest);
    setAnalysisState(beginRequest);
    setStatsState(beginRequest);
    setFreshnessState(beginRequest);

    const requestedFilters = { ...filtersRef.current };
    const filterKey = JSON.stringify(requestedFilters);
    const [feedResult, analysisResult, statsResult, freshnessResult] =
      await Promise.allSettled([
        queryClient.fetchQuery({
          queryKey: ["news", "page", filterKey, 0],
          staleTime: 0,
          queryFn: () =>
            getNewsPage(requestedFilters, 0, { signal: controller.signal }),
        }),
        queryClient.fetchQuery({
          queryKey: ["news", "analysis", filterKey],
          staleTime: 0,
          queryFn: () =>
            getAnalysis(requestedFilters, { signal: controller.signal }),
        }),
        queryClient.fetchQuery({
          queryKey: ["news", "stats", filterKey],
          staleTime: 0,
          queryFn: () =>
            getStats(requestedFilters, { signal: controller.signal }),
        }),
        queryClient.fetchQuery({
          queryKey: ["news", "ingestion-status"],
          staleTime: 0,
          queryFn: () => getIngestionStatus({ signal: controller.signal }),
        }),
      ]);

    if (currentRequest !== requestId.current) return;

    if (feedResult.status === "fulfilled") {
      seenArticleKeys.current = new Set(
        feedResult.value.items.flatMap((article) => [
          `id:${article.id}`,
          `external:${article.external_id}`,
        ]),
      );
      setFeedState((current) => resolveRequest(current, feedResult.value));
    } else if (!isAbortError(feedResult.reason)) {
      const problem = apiProblemFrom(feedResult.reason, "market feed");
      setFeedState((current) => ({
        ...current,
        phase: "error",
        error: problem,
      }));
    }

    if (analysisResult.status === "fulfilled") {
      setAnalysisState((current) =>
        resolveRequest(current, analysisResult.value),
      );
    } else if (!isAbortError(analysisResult.reason)) {
      const problem = apiProblemFrom(analysisResult.reason, "market analysis");
      setAnalysisState((current) => ({
        ...current,
        phase: "error",
        error: problem,
      }));
    }

    if (statsResult.status === "fulfilled") {
      setStatsState((current) => resolveRequest(current, statsResult.value));
    } else if (!isAbortError(statsResult.reason)) {
      const problem = apiProblemFrom(statsResult.reason, "market statistics");
      setStatsState((current) => ({
        ...current,
        phase: "error",
        error: problem,
      }));
    }

    if (freshnessResult.status === "fulfilled") {
      setFreshnessState((current) =>
        resolveRequest(current, freshnessResult.value),
      );
    } else if (!isAbortError(freshnessResult.reason)) {
      const problem = apiProblemFrom(freshnessResult.reason, "news freshness");
      setFreshnessState((current) => ({
        ...current,
        phase: "error",
        error: problem,
      }));
    }

    refreshController.current = null;
  }, [queryClient]);

  const loadMore = useCallback(async () => {
    const feed = feedState.data;
    if (loadingMore || !feed?.has_more) return;
    pageController.current?.abort();
    const controller = new AbortController();
    pageController.current = controller;
    const requestedFilters = JSON.stringify(filtersRef.current);
    setLoadingMore(true);
    setPaginationError(null);
    try {
      const cursorOrOffset = feed.next_cursor ?? feed.items.length;
      const page = await queryClient.fetchQuery({
        queryKey: [
          "news",
          "page",
          JSON.stringify(filtersRef.current),
          cursorOrOffset,
        ],
        queryFn: () =>
          getNewsPage(filtersRef.current, cursorOrOffset, {
            signal: controller.signal,
          }),
      });
      if (requestedFilters !== JSON.stringify(filtersRef.current)) return;
      setFeedState((current) => {
        if (!current.data) return resolveRequest(current, page);
        const ids = new Set(
          current.data.items.flatMap((article) => [
            `id:${article.id}`,
            `external:${article.external_id}`,
          ]),
        );
        const additions = page.items.filter(
          (article) =>
            !ids.has(`id:${article.id}`) &&
            !ids.has(`external:${article.external_id}`),
        );
        for (const article of additions) {
          seenArticleKeys.current.add(`id:${article.id}`);
          seenArticleKeys.current.add(`external:${article.external_id}`);
        }
        return resolveRequest(current, {
          ...current.data,
          items: [...current.data.items, ...additions],
          total: page.total,
          has_more: page.has_more,
          next_cursor: page.next_cursor,
        });
      });
    } catch (error) {
      if (!isAbortError(error)) {
        setPaginationError(apiProblemFrom(error, "market feed"));
      }
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }, [feedState.data, loadingMore, queryClient]);

  useEffect(() => {
    const timeout = setTimeout(() => void refresh(), filters.search ? 280 : 0);
    return () => clearTimeout(timeout);
  }, [filters, refresh]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconciliation: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let reconnectAttempt = 0;
    const burstRefresh = createBurstScheduler(() => void refresh());

    const scheduleReconciliation = (delay: number) => {
      if (reconciliation) clearInterval(reconciliation);
      const jitteredDelay = Math.round(delay * (0.8 + Math.random() * 0.4));
      reconciliation = setInterval(async () => {
        if (
          typeof document !== "undefined" &&
          document.visibilityState === "hidden"
        ) {
          return;
        }
        try {
          const rev = await getNewsRevision(filtersRef.current);
          if (
            lastRevisionRef.current &&
            rev.revision === lastRevisionRef.current
          ) {
            return;
          }
          lastRevisionRef.current = rev.revision;
        } catch {
          // ignore revision check error and attempt normal refresh
        }
        void refresh();
      }, jitteredDelay);
    };
    const beginPolling = () => {
      setStatus("polling");
      scheduleReconciliation(FALLBACK_RECONCILIATION_MS);
    };
    const connect = () => {
      if (closed) return;
      const socketConfig = getWebSocketConfig(window.location);
      if (!socketConfig.value || typeof WebSocket === "undefined") {
        if (socketConfig.issue) {
          console.warn(`Borza realtime disabled: ${socketConfig.issue}`);
        }
        beginPolling();
        return;
      }
      setStatus("connecting");
      try {
        socket = new WebSocket(socketConfig.value);
      } catch {
        beginPolling();
        retry = setTimeout(connect, reconnectDelay(reconnectAttempt++));
        return;
      }
      socket.onopen = () => {
        reconnectAttempt = 0;
        setStatus("live");
        scheduleReconciliation(LIVE_RECONCILIATION_MS);
        void refresh();
      };
      socket.onmessage = (event) => {
        const message = parseNewsSocketMessage(event.data);
        if (!message) {
          console.warn("Ignored a malformed Borza stream event");
          return;
        }
        if (message.type === "ping") {
          socket?.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (message.type === "pong") return;

        if (
          message.type === "article.created" &&
          !eventDedupe.current.accept(message)
        ) {
          return;
        }
        burstRefresh.schedule();
        const article = message.data;
        if (!matchesFilters(article, filtersRef.current)) return;

        const idKey = `id:${article.id}`;
        const externalKey = `external:${article.external_id}`;
        if (
          seenArticleKeys.current.has(idKey) ||
          seenArticleKeys.current.has(externalKey)
        ) {
          return;
        }
        seenArticleKeys.current.add(idKey);
        seenArticleKeys.current.add(externalKey);
        setFeedState((current) => {
          if (!current.data) return current;
          const items = mergeArticle(
            current.data.items,
            article,
            current.data.limit,
          );
          return {
            ...current,
            data: {
              ...current.data,
              items,
              total: current.data.total + 1,
              has_more: current.data.total + 1 > items.length,
            },
          };
        });
        setAnalysisState((current) => {
          if (!current.data) return current;
          return {
            ...current,
            data: {
              ...current.data,
              articles: mergeArticle(
                current.data.articles,
                article,
                current.data.sample_limit,
              ),
              sample_size: Math.min(
                current.data.sample_size + 1,
                current.data.sample_limit,
              ),
              total_matching: current.data.total_matching + 1,
            },
          };
        });
      };
      socket.onclose = () => {
        if (closed) return;
        beginPolling();
        retry = setTimeout(connect, reconnectDelay(reconnectAttempt++));
      };
      socket.onerror = () => socket?.close();
    };

    const reconcileWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    connect();
    document.addEventListener("visibilitychange", reconcileWhenVisible);
    return () => {
      closed = true;
      socket?.close();
      if (reconciliation) clearInterval(reconciliation);
      if (retry) clearTimeout(retry);
      burstRefresh.cancel();
      document.removeEventListener("visibilitychange", reconcileWhenVisible);
    };
  }, [refresh]);

  useEffect(
    () => () => {
      requestId.current += 1;
      refreshController.current?.abort();
      pageController.current?.abort();
    },
    [],
  );

  return {
    feedState,
    analysisState,
    statsState,
    freshnessState,
    status,
    refresh,
    loadingMore,
    paginationError,
    loadMore,
  };
}
