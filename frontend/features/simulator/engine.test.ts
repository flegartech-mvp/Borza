import { describe, expect, it, vi } from "vitest";
import {
  calculateAnalytics,
  closeLocalPosition,
  evaluateProcessEvidence,
  validateExposure,
  validateProtectiveLevels,
  type LocalPosition,
} from "./engine";

describe("simulator engine", () => {
  it("includes entry and exit commissions in realized P&L", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "trade-1" });
    const position: LocalPosition = {
      id: "position-1",
      side: "long",
      quantity: 10,
      entry: 100,
      openedAt: 10,
      plannedRiskCash: 20,
      entryCommission: 2,
      ruleViolations: [],
    };
    const trade = closeLocalPosition({
      position,
      rawPrice: 102,
      spreadBps: 0,
      slippageBps: 0,
      commission: 2,
      candleIndex: 13,
    });
    expect(trade.pnl).toBe(16);
    expect(trade.r).toBe(0.8);
    expect(trade.bars).toBe(3);
    vi.unstubAllGlobals();
  });

  it("validates direction, risk cap, and leverage cap", () => {
    expect(validateProtectiveLevels("long", 100, 101, 105)).toBe(
      "invalid_stop",
    );
    expect(validateProtectiveLevels("short", 100, 105, 95)).toBe(null);
    expect(validateProtectiveLevels("long", 100, 95, 99)).toBe(
      "invalid_target",
    );
    expect(
      validateExposure({
        balance: 10_000,
        price: 100,
        quantity: 0,
        riskPercent: 0.5,
      }),
    ).toBe("positive_values");
    expect(
      validateExposure({
        balance: 10_000,
        price: 100,
        quantity: 10,
        riskPercent: 1,
        maximumRiskPercent: 0.5,
      }),
    ).toBe("risk_cap");
    expect(
      validateExposure({
        balance: 1_000,
        price: 100,
        quantity: 60,
        riskPercent: 0.5,
      }),
    ).toBe("leverage_cap");
    expect(
      validateExposure({
        balance: 10_000,
        price: 100,
        quantity: 10,
        riskPercent: 0.5,
      }),
    ).toBe(null);
  });

  it("calculates drawdown and violation evidence from closed trades", () => {
    const analytics = calculateAnalytics([
      {
        id: "1",
        side: "long",
        quantity: 1,
        entry: 1,
        exit: 1,
        pnl: 100,
        r: 1,
        bars: 2,
        ruleViolations: [],
      },
      {
        id: "2",
        side: "long",
        quantity: 1,
        entry: 1,
        exit: 1,
        pnl: -40,
        r: -0.4,
        bars: 3,
        ruleViolations: ["missing_stop_loss"],
      },
      {
        id: "3",
        side: "short",
        quantity: 1,
        entry: 1,
        exit: 1,
        pnl: -80,
        r: -0.8,
        bars: 4,
        ruleViolations: ["risk_cap", "leverage_cap"],
      },
    ]);
    expect(analytics.net).toBe(-20);
    expect(analytics.maxDrawdown).toBe(120);
    expect(analytics.violations).toBe(3);
    expect(analytics.winRate).toBeCloseTo(33.333, 2);
  });

  it("scores a documented controlled loss above an undocumented reckless win", () => {
    const disciplined = evaluateProcessEvidence({
      ruleViolations: [],
      decisionNote:
        "The setup fails below support and I will honour the daily limit.",
      riskDefinedBeforeEntry: true,
      concentrationChecked: true,
      madeTrade: true,
    });
    const reckless = evaluateProcessEvidence({
      ruleViolations: ["missing_stop_loss", "risk_cap"],
      decisionNote: "Looks good",
      riskDefinedBeforeEntry: false,
      concentrationChecked: false,
      madeTrade: true,
    });
    expect(disciplined.score).toBe(100);
    expect(reckless.score).toBe(0);
    expect(disciplined.followedRules).toContain("decision_reason_documented");
    expect(reckless.violatedRules).toContain("risk_not_defined_before_entry");
  });
});
