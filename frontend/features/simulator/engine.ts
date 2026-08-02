export type SimulatorSide = "long" | "short";

export type LocalPosition = {
  id: string;
  side: SimulatorSide;
  quantity: number;
  entry: number;
  stop?: number;
  target?: number;
  openedAt: number;
  plannedRiskCash: number;
  entryCommission: number;
  ruleViolations: string[];
};

export type LocalTrade = {
  id: string;
  side: SimulatorSide;
  quantity: number;
  entry: number;
  exit: number;
  pnl: number;
  r: number;
  bars: number;
  ruleViolations: string[];
};

export type Analytics = {
  net: number;
  grossProfit: number;
  grossLoss: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  payoff: number;
  expectancy: number;
  profitFactor: number;
  maxDrawdown: number;
  averageR: number;
  best: number;
  worst: number;
  holding: number;
  violations: number;
};

export type ProcessEvaluation = {
  score: number;
  followedRules: string[];
  violatedRules: string[];
};

const PROCESS_PENALTIES: Record<string, number> = {
  missing_stop_loss: 20,
  risk_cap: 30,
  risk_above_scenario_cap: 30,
  leverage_cap: 50,
  leverage_above_5x: 50,
  leverage_above_2x: 10,
  daily_loss_limit_reached: 40,
  risk_not_defined_before_entry: 25,
  decision_reason_not_documented: 15,
  concentration_not_checked: 10,
};

export function evaluateProcessEvidence({
  ruleViolations,
  decisionNote,
  riskDefinedBeforeEntry,
  concentrationChecked,
  madeTrade,
}: {
  ruleViolations: string[];
  decisionNote: string;
  riskDefinedBeforeEntry: boolean;
  concentrationChecked: boolean;
  madeTrade: boolean;
}): ProcessEvaluation {
  const violated = new Set(ruleViolations);
  const followed: string[] = [];
  if (riskDefinedBeforeEntry) followed.push("risk_defined_before_entry");
  else violated.add("risk_not_defined_before_entry");
  if (decisionNote.trim().split(/\s+/).filter(Boolean).length >= 8)
    followed.push("decision_reason_documented");
  else violated.add("decision_reason_not_documented");
  if (concentrationChecked) followed.push("concentration_checked");
  else if (madeTrade) violated.add("concentration_not_checked");
  if (!madeTrade) followed.push("no_trade_choice");
  if (!violated.has("missing_stop_loss") && madeTrade)
    followed.push("protective_stop_used");
  if (
    !violated.has("risk_cap") &&
    !violated.has("risk_above_scenario_cap") &&
    madeTrade
  )
    followed.push("risk_within_scenario_cap");
  const violatedRules = [...violated].sort();
  return {
    score: Math.max(
      0,
      100 -
        violatedRules.reduce(
          (sum, item) => sum + (PROCESS_PENALTIES[item] ?? 10),
          0,
        ),
    ),
    followedRules: followed.sort(),
    violatedRules,
  };
}

export function executionPrice(
  rawPrice: number,
  side: SimulatorSide,
  spreadBps: number,
  slippageBps: number,
  closing = false,
): number {
  const direction = side === "long" ? 1 : -1;
  const signedDirection = closing ? -direction : direction;
  return (
    rawPrice *
    (1 + signedDirection * (spreadBps / 20_000 + slippageBps / 10_000))
  );
}

export function validateProtectiveLevels(
  side: SimulatorSide,
  referencePrice: number,
  stop?: number,
  target?: number,
): string | null {
  if (
    stop !== undefined &&
    (side === "long" ? stop >= referencePrice : stop <= referencePrice)
  )
    return "invalid_stop";
  if (
    target !== undefined &&
    (side === "long" ? target <= referencePrice : target >= referencePrice)
  )
    return "invalid_target";
  return null;
}

export function validateExposure({
  balance,
  price,
  quantity,
  riskPercent,
  maximumRiskPercent = 1,
  maximumLeverage = 5,
}: {
  balance: number;
  price: number;
  quantity: number;
  riskPercent: number;
  maximumRiskPercent?: number;
  maximumLeverage?: number;
}): string | null {
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(riskPercent) ||
    riskPercent <= 0
  )
    return "positive_values";
  if (riskPercent > maximumRiskPercent) return "risk_cap";
  if ((price * quantity) / balance > maximumLeverage) return "leverage_cap";
  return null;
}

export function closeLocalPosition({
  position,
  rawPrice,
  spreadBps,
  slippageBps,
  commission,
  candleIndex,
}: {
  position: LocalPosition;
  rawPrice: number;
  spreadBps: number;
  slippageBps: number;
  commission: number;
  candleIndex: number;
}): LocalTrade {
  const exit = executionPrice(
    rawPrice,
    position.side,
    spreadBps,
    slippageBps,
    true,
  );
  const direction = position.side === "long" ? 1 : -1;
  const grossPnl = (exit - position.entry) * position.quantity * direction;
  const pnl = grossPnl - position.entryCommission - commission;
  return {
    id: crypto.randomUUID(),
    side: position.side,
    quantity: position.quantity,
    entry: position.entry,
    exit,
    pnl,
    r: position.plannedRiskCash > 0 ? pnl / position.plannedRiskCash : 0,
    bars: Math.max(1, candleIndex - position.openedAt),
    ruleViolations: position.ruleViolations,
  };
}

export function calculateAnalytics(trades: LocalTrade[]): Analytics {
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const net = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const averageWin = wins.length ? grossProfit / wins.length : 0;
  const averageLoss = losses.length ? grossLoss / losses.length : 0;
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const trade of trades) {
    equity += trade.pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  return {
    net,
    grossProfit,
    grossLoss,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    averageWin,
    averageLoss,
    payoff: averageLoss ? averageWin / averageLoss : 0,
    expectancy: trades.length ? net / trades.length : 0,
    profitFactor: grossLoss
      ? grossProfit / grossLoss
      : grossProfit
        ? Number.POSITIVE_INFINITY
        : 0,
    maxDrawdown,
    averageR: trades.length
      ? trades.reduce((sum, trade) => sum + trade.r, 0) / trades.length
      : 0,
    best: trades.length ? Math.max(...trades.map((trade) => trade.pnl)) : 0,
    worst: trades.length ? Math.min(...trades.map((trade) => trade.pnl)) : 0,
    holding: trades.length
      ? trades.reduce((sum, trade) => sum + trade.bars, 0) / trades.length
      : 0,
    violations: trades.reduce(
      (sum, trade) => sum + trade.ruleViolations.length,
      0,
    ),
  };
}
