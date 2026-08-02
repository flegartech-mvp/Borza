"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CirclePause,
  CirclePlay,
  Info,
  ShieldAlert,
  StepForward,
} from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button } from "@/components/ui/button";
import { ChartLoader } from "@/features/charts/chart-loader";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { usePreferences } from "@/features/preferences";
import type { DemoCandle, SimulatorSummary } from "@/lib/academy-types";
import { academyApi } from "@/lib/api-client";
import { DEMO_SCENARIO } from "@/lib/demo-academy";
import {
  calculateAnalytics,
  closeLocalPosition,
  executionPrice,
  validateExposure,
  validateProtectiveLevels,
  type LocalPosition,
  type LocalTrade,
  type SimulatorSide,
} from "./engine";

type OrderType = "market" | "limit" | "stop" | "bracket";
type PendingOrder = {
  id: string;
  side: SimulatorSide;
  type: "limit" | "stop";
  quantity: number;
  trigger: number;
  plannedRiskCash: number;
};
type RemoteOrder = {
  id: string;
  status: string;
  rejection_reason?: string | null;
  side: string;
  quantity: number | string;
  trigger_price?: number | string | null;
};
type RemoteTrade = {
  id: string;
  side: string;
  quantity: number | string;
  entry_price: number | string;
  exit_price: number | string;
  net_pnl: number | string;
  r_multiple?: number | string | null;
  opened_at: string;
  closed_at: string;
  rule_violations: string[];
};
type RemoteSession = {
  id: string;
  version: number;
  status: string;
  initial_balance: number | string;
  cash_balance: number | string;
  equity: number | string;
  realized_pnl: number | string;
  unrealized_pnl: number | string;
  position_quantity: number | string;
  average_entry_price?: number | string | null;
  position_stop_loss?: number | string | null;
  position_take_profit?: number | string | null;
  current_candle_index: number;
  visible_candles: Array<Record<string, number | string>>;
  rule_violations: string[];
  orders: RemoteOrder[];
  pending_orders: RemoteOrder[];
  trades: RemoteTrade[];
};
type RemoteResults = {
  metrics: Record<string, number | string | null>;
  process: {
    score: number;
    followed_rules: string[];
    violated_rules: string[];
    unevaluated_scenario_rules: string[];
  };
  debrief: Record<string, unknown>;
  related_lessons: string[];
  recommended_review_cards: string[];
};

const MAX_RISK_PERCENT = 0.5;
const MAX_LEVERAGE = 5;
const asNumber = (value: number | string | null | undefined) =>
  Number(value ?? 0);
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function remoteCandles(session: RemoteSession): DemoCandle[] {
  return session.visible_candles.map((candle, index) => ({
    time:
      typeof candle.time === "string"
        ? Math.floor(new Date(candle.time).getTime() / 1000)
        : Number(candle.time ?? index),
    open: asNumber(candle.open),
    high: asNumber(candle.high),
    low: asNumber(candle.low),
    close: asNumber(candle.close),
    volume: asNumber(candle.volume),
  }));
}

function remoteTrades(session: RemoteSession): LocalTrade[] {
  return session.trades.map((trade) => ({
    id: trade.id,
    side: trade.side === "short" ? "short" : "long",
    quantity: asNumber(trade.quantity),
    entry: asNumber(trade.entry_price),
    exit: asNumber(trade.exit_price),
    pnl: asNumber(trade.net_pnl),
    r: asNumber(trade.r_multiple),
    bars: Math.max(
      1,
      Math.round(
        (Date.parse(trade.closed_at) - Date.parse(trade.opened_at)) / 300_000,
      ),
    ),
    ruleViolations: trade.rule_violations ?? [],
  }));
}

const simulatorCopy = {
  de: {
    trigger: "Auslösepreis",
    takeProfit: "Gewinnziel",
    costs: "Kosten und Ausführung",
    pendingCount: "wartend",
    positive: "Stückzahl und Risiko müssen positiv sein.",
    riskCap: `Für dieses Szenario gilt höchstens ${MAX_RISK_PERCENT} % Risiko pro Trade.`,
    leverageCap: `Die simulierte Exposure ist auf ${MAX_LEVERAGE}× Kontowert begrenzt.`,
    invalidStop:
      "Der Stop muss bei Long unter und bei Short über dem Referenzpreis liegen.",
    invalidTarget:
      "Das Ziel muss bei Long über und bei Short unter dem Referenzpreis liegen.",
    oneOrder:
      "Schließe die aktive Position oder warte auf die Order, bevor du eine neue platzierst.",
    noData: "Keine Daten",
    finishError: "Das Szenario konnte nicht abgeschlossen werden.",
    realized: "Realisierter simulierter Kontostand nach Kosten.",
    equity:
      "Kontostand plus nicht realisierter simulierter Gewinn oder Verlust.",
    process:
      "Bewertet Risikoregeln und Disziplin, nicht ob ein Trade gewonnen hat.",
    metricLabels: [
      "Netto P&L",
      "Bruttogewinn",
      "Bruttoverlust",
      "Trefferquote",
      "Ø Gewinn",
      "Ø Verlust",
      "Payoff Ratio",
      "Erwartungswert",
      "Profit Factor",
      "Maximaler Drawdown",
      "Ø R",
      "Bester Trade",
      "Schlechtester Trade",
      "Ø Haltedauer",
      "Regelverstöße",
    ],
    metricDetails: [
      "Realisierte Gewinne minus Verluste nach simulierten Kosten.",
      "Summe aller profitablen Trades.",
      "Absoluter Betrag aller Verlusttrades.",
      "Anteil profitabler abgeschlossener Trades.",
      "Mittlerer Gewinn der Gewinntrades.",
      "Mittlerer absoluter Verlust der Verlusttrades.",
      "Durchschnittsgewinn geteilt durch Durchschnittsverlust.",
      "Mittleres simuliertes Ergebnis pro Trade.",
      "Bruttogewinn geteilt durch Bruttoverlust.",
      "Größter Rückgang vom bisherigen Hoch.",
      "Mittleres Ergebnis relativ zum geplanten Risiko.",
      "Größtes einzelnes Ergebnis.",
      "Kleinstes einzelnes Ergebnis.",
      "Mittlere Zahl gehaltener Kerzen.",
      "Dokumentierte Abweichungen von Risikoregeln.",
    ],
  },
  sl: {
    trigger: "Sprožilna cena",
    takeProfit: "Ciljni dobiček",
    costs: "Stroški in izvršitev",
    pendingCount: "čakajočih",
    positive: "Količina in tveganje morata biti pozitivna.",
    riskCap: `V tem scenariju je največje tveganje ${MAX_RISK_PERCENT} % na posel.`,
    leverageCap: `Simulirana izpostavljenost je omejena na ${MAX_LEVERAGE}× vrednost računa.`,
    invalidStop:
      "Stop mora biti pri dolgi poziciji pod, pri kratki pa nad referenčno ceno.",
    invalidTarget:
      "Cilj mora biti pri dolgi poziciji nad, pri kratki pa pod referenčno ceno.",
    oneOrder:
      "Pred novim naročilom zapri aktivno pozicijo ali počakaj na čakajoče naročilo.",
    noData: "Ni podatkov",
    finishError: "Scenarija ni bilo mogoče dokončati.",
    realized: "Realizirano simulirano stanje po stroških.",
    equity: "Stanje skupaj z nerealiziranim simuliranim dobičkom ali izgubo.",
    process:
      "Ocenjuje pravila tveganja in disciplino, ne dobičkonosnosti posla.",
    metricLabels: [
      "Neto P&L",
      "Bruto dobiček",
      "Bruto izguba",
      "Uspešnost",
      "Povprečen dobiček",
      "Povprečna izguba",
      "Razmerje izplačila",
      "Pričakovana vrednost",
      "Faktor dobička",
      "Največji padec",
      "Povprečni R",
      "Najboljši posel",
      "Najslabši posel",
      "Povprečno trajanje",
      "Kršitve pravil",
    ],
    metricDetails: [
      "Realizirani dobički minus izgube po simuliranih stroških.",
      "Vsota dobičkonosnih poslov.",
      "Absolutna vsota izgub.",
      "Delež zaključenih poslov s pozitivnim izidom.",
      "Povprečen dobiček uspešnih poslov.",
      "Povprečna absolutna izguba neuspešnih poslov.",
      "Povprečen dobiček deljen s povprečno izgubo.",
      "Povprečen simuliran izid na posel.",
      "Bruto dobiček deljen z bruto izgubo.",
      "Največji padec od doseženega vrha.",
      "Povprečen izid glede na načrtovano tveganje.",
      "Največji posamični izid.",
      "Najmanjši posamični izid.",
      "Povprečno število sveč v poziciji.",
      "Zabeležena odstopanja od pravil tveganja.",
    ],
  },
  en: {
    trigger: "Trigger price",
    takeProfit: "Take profit",
    costs: "Costs and execution",
    pendingCount: "pending",
    positive: "Quantity and risk must be positive.",
    riskCap: `This scenario allows at most ${MAX_RISK_PERCENT}% risk per trade.`,
    leverageCap: `Simulated exposure is capped at ${MAX_LEVERAGE}× account equity.`,
    invalidStop:
      "A long stop must be below, and a short stop above, the reference price.",
    invalidTarget:
      "A long target must be above, and a short target below, the reference price.",
    oneOrder:
      "Close the active position or let the pending order resolve before placing another.",
    noData: "No data",
    finishError: "The scenario could not be completed.",
    realized: "Realized simulated cash after costs.",
    equity: "Cash plus unrealized simulated profit or loss.",
    process: "Scores risk rules and discipline, not whether a trade won.",
    metricLabels: [
      "Net P&L",
      "Gross profit",
      "Gross loss",
      "Win rate",
      "Average win",
      "Average loss",
      "Payoff ratio",
      "Expectancy",
      "Profit factor",
      "Maximum drawdown",
      "Average R",
      "Best trade",
      "Worst trade",
      "Average holding",
      "Rule violations",
    ],
    metricDetails: [
      "Realized profit minus loss after simulated costs.",
      "Sum of profitable trades.",
      "Absolute sum of losing trades.",
      "Share of closed trades with positive P&L.",
      "Mean profit across winning trades.",
      "Mean absolute loss across losing trades.",
      "Average win divided by average loss.",
      "Average simulated P&L per closed trade.",
      "Gross profit divided by gross loss.",
      "Largest peak-to-trough realized equity decline.",
      "Average result relative to planned risk.",
      "Largest single simulated trade result.",
      "Smallest single simulated trade result.",
      "Mean number of candles held.",
      "Documented risk-rule deviations.",
    ],
  },
};

export function TradingSimulator() {
  const router = useRouter();
  const { dictionary, language } = usePreferences();
  const copy = simulatorCopy[language];
  const { mode, saveSimulatorSummary } = useDemoWorkspace();
  const [index, setIndex] = useState(DEMO_SCENARIO.initialVisibleCandles);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [startingBalance, setStartingBalance] = useState(10_000);
  const [cash, setCash] = useState(10_000);
  const [side, setSide] = useState<SimulatorSide>("long");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [quantity, setQuantity] = useState(20);
  const [riskPercent, setRiskPercent] = useState(MAX_RISK_PERCENT);
  const [trigger, setTrigger] = useState(103);
  const [stop, setStop] = useState(100);
  const [target, setTarget] = useState(108);
  const [spreadBps, setSpreadBps] = useState(4);
  const [commission, setCommission] = useState(1);
  const [slippageBps, setSlippageBps] = useState(2);
  const [position, setPosition] = useState<LocalPosition | null>(null);
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const [trades, setTrades] = useState<LocalTrade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [remoteSession, setRemoteSession] = useState<RemoteSession | null>(
    null,
  );
  const [finishing, setFinishing] = useState(false);
  const remoteSessionRef = useRef<RemoteSession | null>(null);
  const steppingRef = useRef(false);

  const candles =
    mode === "authenticated" && remoteSession
      ? remoteCandles(remoteSession)
      : DEMO_SCENARIO.candles.slice(0, index);
  const last = candles.at(-1) ?? DEMO_SCENARIO.candles[0];
  const displayTrades =
    mode === "authenticated" && remoteSession
      ? remoteTrades(remoteSession)
      : trades;
  const analytics = useMemo(
    () => calculateAnalytics(displayTrades),
    [displayTrades],
  );
  const remoteHasPosition = Boolean(
    remoteSession && asNumber(remoteSession.position_quantity),
  );
  const displayCash = remoteSession
    ? asNumber(remoteSession.cash_balance)
    : cash;
  const localUnrealized = position
    ? (position.side === "long"
        ? last.close - position.entry
        : position.entry - last.close) * position.quantity
    : 0;
  const displayEquity = remoteSession
    ? asNumber(remoteSession.equity)
    : cash + localUnrealized;
  const violations =
    remoteSession?.rule_violations.length ?? analytics.violations;
  const processScore = clamp(100 - violations * 15, 0, 100);

  const acceptRemote = useCallback((session: RemoteSession) => {
    remoteSessionRef.current = session;
    setRemoteSession(session);
    setIndex(session.current_candle_index + 1);
    return session;
  }, []);

  const ensureRemoteSession = useCallback(async () => {
    if (mode !== "authenticated") return null;
    if (remoteSessionRef.current) return remoteSessionRef.current;
    const created = await academyApi<RemoteSession>("/simulator/sessions", {
      method: "POST",
      body: {
        scenario_id: DEMO_SCENARIO.id,
        initial_balance: startingBalance,
        spread_bps: spreadBps,
        slippage_bps: slippageBps,
        commission_fixed: commission,
        commission_bps: 0,
        planned_risk: startingBalance * (riskPercent / 100),
      },
    });
    return acceptRemote(created);
  }, [
    acceptRemote,
    commission,
    mode,
    riskPercent,
    slippageBps,
    spreadBps,
    startingBalance,
  ]);

  const closeDemo = useCallback(
    (active: LocalPosition, rawPrice: number) => {
      const trade = closeLocalPosition({
        position: active,
        rawPrice,
        spreadBps,
        slippageBps,
        commission,
        candleIndex: index,
      });
      setCash((value) => value + trade.pnl + active.entryCommission);
      setPosition(null);
      setTrades((value) => [...value, trade]);
      return trade;
    },
    [commission, index, slippageBps, spreadBps],
  );

  const processDemoCandle = useCallback(
    (nextIndex: number) => {
      const candle = DEMO_SCENARIO.candles[nextIndex - 1];
      if (!candle) return;
      let active = position;
      if (!active && pending) {
        const triggered =
          pending.type === "limit"
            ? pending.side === "long"
              ? candle.low <= pending.trigger
              : candle.high >= pending.trigger
            : pending.side === "long"
              ? candle.high >= pending.trigger
              : candle.low <= pending.trigger;
        if (triggered) {
          const entry = executionPrice(
            pending.trigger,
            pending.side,
            spreadBps,
            slippageBps,
          );
          active = {
            id: crypto.randomUUID(),
            side: pending.side,
            quantity: pending.quantity,
            entry,
            openedAt: nextIndex,
            plannedRiskCash: pending.plannedRiskCash,
            entryCommission: commission,
            ruleViolations: ["missing_stop_loss"],
          };
          setCash((value) => value - commission);
          setPosition(active);
          setPending(null);
        }
      }
      if (active) {
        const stopped =
          active.stop !== undefined &&
          (active.side === "long"
            ? candle.low <= active.stop
            : candle.high >= active.stop);
        const targeted =
          active.target !== undefined &&
          (active.side === "long"
            ? candle.high >= active.target
            : candle.low <= active.target);
        if (stopped) closeDemo(active, active.stop as number);
        else if (targeted) closeDemo(active, active.target as number);
      }
    },
    [closeDemo, commission, pending, position, slippageBps, spreadBps],
  );

  const step = useCallback(async () => {
    if (steppingRef.current) return;
    steppingRef.current = true;
    try {
      if (mode === "authenticated") {
        const session = await ensureRemoteSession();
        if (!session || session.status === "completed") {
          setPlaying(false);
          return;
        }
        const updated = await academyApi<RemoteSession>(
          `/simulator/sessions/${session.id}/step`,
          {
            method: "POST",
            body: { candles: 1, expected_version: session.version },
          },
        );
        acceptRemote(updated);
        if (updated.status === "completed") setPlaying(false);
      } else {
        if (index >= DEMO_SCENARIO.candles.length) {
          setPlaying(false);
          return;
        }
        const next = index + 1;
        processDemoCandle(next);
        setIndex(next);
      }
    } catch (reason) {
      setPlaying(false);
      setError(
        reason instanceof Error ? reason.message : dictionary.auth.error,
      );
    } finally {
      steppingRef.current = false;
    }
  }, [
    acceptRemote,
    dictionary.auth.error,
    ensureRemoteSession,
    index,
    mode,
    processDemoCandle,
  ]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => void step(), 1000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, step]);

  const validateOrder = () => {
    const reference =
      orderType === "limit" || orderType === "stop" ? trigger : last.close;
    const exposureError = validateExposure({
      balance: displayEquity,
      price: reference,
      quantity,
      riskPercent,
      maximumRiskPercent: MAX_RISK_PERCENT,
      maximumLeverage: MAX_LEVERAGE,
    });
    if (exposureError === "positive_values") return copy.positive;
    if (exposureError === "risk_cap") return copy.riskCap;
    if (exposureError === "leverage_cap") return copy.leverageCap;
    if (
      position ||
      pending ||
      remoteHasPosition ||
      Boolean(remoteSession?.pending_orders.length)
    )
      return copy.oneOrder;
    if (orderType === "bracket") {
      const protection = validateProtectiveLevels(
        side,
        reference,
        stop,
        target,
      );
      if (protection === "invalid_stop") return copy.invalidStop;
      if (protection === "invalid_target") return copy.invalidTarget;
    }
    return null;
  };

  const placeOrder = async () => {
    setError(null);
    const validation = validateOrder();
    if (validation) {
      setError(validation);
      return;
    }
    const plannedRiskCash = startingBalance * (riskPercent / 100);
    try {
      if (mode === "authenticated") {
        const session = await ensureRemoteSession();
        if (!session) return;
        const backendType = orderType === "bracket" ? "market" : orderType;
        const updated = await academyApi<RemoteSession>(
          `/simulator/sessions/${session.id}/orders`,
          {
            method: "POST",
            body: {
              expected_version: session.version,
              client_order_id: crypto.randomUUID(),
              side: side === "long" ? "buy" : "sell",
              order_type: backendType,
              quantity,
              trigger_price: backendType === "market" ? undefined : trigger,
              stop_loss: orderType === "bracket" ? stop : undefined,
              take_profit: orderType === "bracket" ? target : undefined,
            },
          },
        );
        acceptRemote(updated);
        const rejected = updated.orders.at(-1);
        if (rejected?.status === "rejected")
          setError(rejected.rejection_reason ?? dictionary.auth.error);
        return;
      }
      if (orderType === "limit" || orderType === "stop") {
        setPending({
          id: crypto.randomUUID(),
          side,
          type: orderType,
          quantity,
          trigger,
          plannedRiskCash,
        });
        return;
      }
      const entry = executionPrice(last.close, side, spreadBps, slippageBps);
      const hasProtection = orderType === "bracket";
      setCash((value) => value - commission);
      setPosition({
        id: crypto.randomUUID(),
        side,
        quantity,
        entry,
        stop: hasProtection ? stop : undefined,
        target: hasProtection ? target : undefined,
        openedAt: index,
        plannedRiskCash: hasProtection
          ? Math.abs(entry - stop) * quantity
          : plannedRiskCash,
        entryCommission: commission,
        ruleViolations: hasProtection ? [] : ["missing_stop_loss"],
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : dictionary.auth.error,
      );
    }
  };

  const closeActivePosition = async () => {
    setError(null);
    try {
      if (mode === "authenticated") {
        const session = remoteSessionRef.current;
        if (!session || !asNumber(session.position_quantity)) return;
        const updated = await academyApi<RemoteSession>(
          `/simulator/sessions/${session.id}/close`,
          {
            method: "POST",
            body: { expected_version: session.version, reason: "manual" },
          },
        );
        acceptRemote(updated);
      } else if (position) closeDemo(position, last.close);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : dictionary.auth.error,
      );
    }
  };

  const finish = async () => {
    setPlaying(false);
    setFinishing(true);
    setError(null);
    try {
      if (mode === "authenticated") {
        let session = await ensureRemoteSession();
        if (!session) throw new Error(copy.finishError);
        if (session.status !== "completed") {
          const remaining = Math.max(
            1,
            DEMO_SCENARIO.candles.length - 1 - session.current_candle_index,
          );
          session = acceptRemote(
            await academyApi<RemoteSession>(
              `/simulator/sessions/${session.id}/step`,
              {
                method: "POST",
                body: { candles: remaining, expected_version: session.version },
              },
            ),
          );
        }
        const result = await academyApi<RemoteResults>(
          `/simulator/sessions/${session.id}/results`,
        );
        const metrics = result.metrics;
        const summary: SimulatorSummary = {
          completedAt: new Date().toISOString(),
          remoteSessionId: session.id,
          netPnl: asNumber(metrics.net_pnl),
          trades: session.trades.length,
          ruleViolations: asNumber(metrics.rule_violations),
          processScore: result.process.score,
          winRate: asNumber(metrics.win_rate),
          expectancy: asNumber(metrics.expectancy),
          profitFactor: asNumber(metrics.profit_factor),
          maxDrawdown: asNumber(metrics.maximum_drawdown),
          followedRules: result.process.followed_rules,
          violatedRules: result.process.violated_rules,
          unevaluatedRules: result.process.unevaluated_scenario_rules,
          debrief: result.debrief,
          relatedLessons: result.related_lessons,
          recommendedReviewCards: result.recommended_review_cards,
        };
        await saveSimulatorSummary(summary);
        router.push(`/simulator/results?session=${session.id}`);
        return;
      }
      let nextTrades = trades;
      if (position) {
        const finalTrade = closeLocalPosition({
          position,
          rawPrice: last.close,
          spreadBps,
          slippageBps,
          commission,
          candleIndex: index,
        });
        nextTrades = [...trades, finalTrade];
        setTrades(nextTrades);
        setCash((value) => value + finalTrade.pnl + position.entryCommission);
        setPosition(null);
      }
      setPending(null);
      const finalAnalytics = calculateAnalytics(nextTrades);
      await saveSimulatorSummary({
        completedAt: new Date().toISOString(),
        netPnl: finalAnalytics.net,
        trades: nextTrades.length,
        ruleViolations: finalAnalytics.violations,
        processScore: clamp(100 - finalAnalytics.violations * 15, 0, 100),
        winRate: finalAnalytics.winRate,
        expectancy: finalAnalytics.expectancy,
        profitFactor: Number.isFinite(finalAnalytics.profitFactor)
          ? finalAnalytics.profitFactor
          : 0,
        maxDrawdown: finalAnalytics.maxDrawdown,
        relatedLessons: [
          "lesson-ta-structure-trends",
          "lesson-rm-position-sizing",
        ],
        recommendedReviewCards: ["card-uptrend", "card-position-size"],
      });
      router.push("/simulator/results");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.finishError);
    } finally {
      setFinishing(false);
    }
  };

  const values = [
    analytics.net,
    analytics.grossProfit,
    analytics.grossLoss,
    analytics.winRate,
    analytics.averageWin,
    analytics.averageLoss,
    analytics.payoff,
    analytics.expectancy,
    analytics.profitFactor,
    analytics.maxDrawdown,
    analytics.averageR,
    analytics.best,
    analytics.worst,
    analytics.holding,
    analytics.violations,
  ];
  const openPosition =
    mode === "authenticated" ? remoteHasPosition : Boolean(position);
  const shownIndex = remoteSession
    ? remoteSession.current_candle_index + 1
    : index;

  return (
    <>
      <PageHeading
        eyebrow={`${dictionary.common.demo} · ${DEMO_SCENARIO.title[language]}`}
        title={dictionary.simulator.title}
        description={dictionary.simulator.intro}
      />
      <div className="mb-4 flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-soft)] p-4 text-sm">
        <ShieldAlert
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--warning)]"
          size={18}
        />
        <div>
          <strong>{dictionary.simulator.warning}</strong>
          <p className="mt-1 text-[var(--text-secondary)]">
            {DEMO_SCENARIO.goal[language]}
          </p>
        </div>
      </div>
      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0 space-y-4">
          <ChartLoader
            candles={candles}
            stop={
              remoteSession
                ? asNumber(remoteSession.position_stop_loss) || undefined
                : position?.stop
            }
            target={
              remoteSession
                ? asNumber(remoteSession.position_take_profit) || undefined
                : position?.target
            }
            label={dictionary.practice.simulated}
          />
          <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
            <Button onClick={() => setPlaying((value) => !value)}>
              {playing ? (
                <CirclePause aria-hidden="true" size={17} />
              ) : (
                <CirclePlay aria-hidden="true" size={17} />
              )}
              {playing ? dictionary.simulator.pause : dictionary.simulator.play}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void step()}
              disabled={
                playing ||
                remoteSession?.status === "completed" ||
                (mode === "demo" && index >= DEMO_SCENARIO.candles.length)
              }
            >
              <StepForward aria-hidden="true" size={17} />
              {dictionary.simulator.step}
            </Button>
            <label className="ml-auto flex items-center gap-2 text-sm">
              {dictionary.simulator.speed}
              <select
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2"
              >
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={4}>4×</option>
              </select>
            </label>
            <span className="numeric text-xs text-[var(--text-tertiary)]">
              {shownIndex}/{DEMO_SCENARIO.candles.length}
            </span>
          </div>
          <section className="grid gap-3 sm:grid-cols-3">
            <Metric
              label={dictionary.simulator.balance}
              value={`€${displayCash.toFixed(2)}`}
              detail={copy.realized}
            />
            <Metric
              label={dictionary.simulator.equity}
              value={`€${displayEquity.toFixed(2)}`}
              detail={copy.equity}
            />
            <Metric
              label={dictionary.simulator.processScore}
              value={`${processScore}%`}
              detail={copy.process}
            />
          </section>
        </section>
        <aside className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
          <h2 className="font-semibold">{dictionary.simulator.orderType}</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSide("long")}
              className={`min-h-11 rounded-[var(--radius-sm)] border font-semibold ${side === "long" ? "border-[var(--positive)] bg-[var(--positive-soft)] text-[var(--positive)]" : "border-[var(--border-subtle)]"}`}
            >
              {dictionary.simulator.long}
            </button>
            <button
              type="button"
              onClick={() => setSide("short")}
              className={`min-h-11 rounded-[var(--radius-sm)] border font-semibold ${side === "short" ? "border-[var(--negative)] bg-[var(--negative-soft)] text-[var(--negative)]" : "border-[var(--border-subtle)]"}`}
            >
              {dictionary.simulator.short}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["market", "limit", "stop", "bracket"] as const).map((type) => (
              <button
                type="button"
                key={type}
                onClick={() => setOrderType(type)}
                className={`min-h-10 rounded-[var(--radius-sm)] border text-sm ${orderType === type ? "border-[var(--electric)] bg-[var(--electric-soft)]" : "border-[var(--border-subtle)]"}`}
              >
                {dictionary.simulator[type]}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <NumberField
              label={dictionary.simulator.size}
              value={quantity}
              onChange={setQuantity}
            />
            <NumberField
              label={`${dictionary.simulator.risk} (%)`}
              value={riskPercent}
              onChange={setRiskPercent}
            />
            {orderType === "limit" || orderType === "stop" ? (
              <NumberField
                label={copy.trigger}
                value={trigger}
                onChange={setTrigger}
              />
            ) : null}
            {orderType === "bracket" ? (
              <>
                <NumberField
                  label={dictionary.simulator.stop}
                  value={stop}
                  onChange={setStop}
                />
                <NumberField
                  label={copy.takeProfit}
                  value={target}
                  onChange={setTarget}
                />
              </>
            ) : null}
          </div>
          <details className="mt-4 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              {copy.costs}
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <NumberField
                label={`${dictionary.simulator.spread} bps`}
                value={spreadBps}
                onChange={setSpreadBps}
              />
              <NumberField
                label={`${dictionary.simulator.slippage} bps`}
                value={slippageBps}
                onChange={setSlippageBps}
              />
              <NumberField
                label={`${dictionary.simulator.commission} €`}
                value={commission}
                onChange={setCommission}
              />
              <NumberField
                disabled={Boolean(
                  remoteSession || trades.length || position || pending,
                )}
                label={`${dictionary.simulator.balance} €`}
                value={startingBalance}
                onChange={(value) => {
                  setStartingBalance(value);
                  setCash(value);
                }}
              />
            </div>
          </details>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-[var(--negative)]">
              {error}
            </p>
          ) : null}
          <Button className="mt-4 w-full" onClick={() => void placeOrder()}>
            {dictionary.simulator.place}
          </Button>
          <section className="mt-5 border-t border-[var(--border-subtle)] pt-4">
            <h3 className="text-sm font-semibold">
              {dictionary.simulator.positions}
            </h3>
            {openPosition ? (
              <div className="mt-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3 text-xs">
                <div className="flex justify-between">
                  <strong>
                    {mode === "authenticated"
                      ? asNumber(remoteSession?.position_quantity) > 0
                        ? dictionary.simulator.long
                        : dictionary.simulator.short
                      : position?.side === "long"
                        ? dictionary.simulator.long
                        : dictionary.simulator.short}
                  </strong>
                  <span className="numeric">
                    {mode === "authenticated"
                      ? Math.abs(asNumber(remoteSession?.position_quantity))
                      : position?.quantity}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void closeActivePosition()}
                  className="mt-2 min-h-10 font-semibold text-[var(--negative)]"
                >
                  {dictionary.simulator.close}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">—</p>
            )}
          </section>
          <section className="mt-4">
            <h3 className="text-sm font-semibold">
              {dictionary.simulator.pending}
            </h3>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              {(remoteSession?.pending_orders.length ?? (pending ? 1 : 0))
                ? `${remoteSession?.pending_orders.length ?? 1} ${copy.pendingCount}`
                : "—"}
            </p>
          </section>
        </aside>
      </div>
      <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--background-raised)] p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xl font-semibold">
            <Activity aria-hidden="true" className="text-[var(--brand)]" />
            {dictionary.simulator.analytics}
          </h3>
          <span className="text-xs text-[var(--text-tertiary)]">
            {displayTrades.length} {dictionary.simulator.history.toLowerCase()}
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {values.map((value, metricIndex) => (
            <Metric
              key={copy.metricLabels[metricIndex]}
              label={copy.metricLabels[metricIndex]}
              value={
                metricIndex === 3
                  ? `${value.toFixed(1)}%`
                  : Number.isFinite(value)
                    ? value.toFixed(2)
                    : "∞"
              }
              detail={copy.metricDetails[metricIndex]}
            />
          ))}
        </div>
        <div className="mt-5">
          <Button loading={finishing} onClick={() => void finish()}>
            {dictionary.simulator.results}
          </Button>
          {remoteSession ? (
            <span className="numeric ml-3 self-center text-xs text-[var(--text-tertiary)]">
              session {remoteSession.id.slice(0, 8)} · v{remoteSession.version}
            </span>
          ) : null}
        </div>
      </section>
    </>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs font-medium text-[var(--text-secondary)]">
      {label}
      <input
        disabled={disabled}
        type="number"
        step="any"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="numeric mt-1 min-h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 disabled:opacity-60"
      />
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
      <p className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
        {label}
        <span title={detail} role="img" aria-label={detail} tabIndex={0}>
          <Info aria-hidden="true" size={13} />
        </span>
      </p>
      <p className="numeric mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
