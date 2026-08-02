import { describe, expect, it } from "vitest";
import {
  CALCULATORS,
  CALCULATOR_IDS,
  calculateTool,
  defaultInputs,
  getCalculator,
  npvAtRate,
  parseLocalizedNumber,
  solveIrr,
} from "./calculators";

function valuesFor(
  id: (typeof CALCULATOR_IDS)[number],
  overrides: Record<string, string> = {},
) {
  const outcome = calculateTool(id, {
    ...defaultInputs(getCalculator(id)),
    ...overrides,
  });
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.issues));
  return outcome.values;
}

describe("calculator catalogue", () => {
  it("contains exactly 18 unique tools with complete DE/SL/EN learning metadata", () => {
    expect(CALCULATORS).toHaveLength(18);
    expect(new Set(CALCULATORS.map((calculator) => calculator.id)).size).toBe(
      18,
    );
    expect(CALCULATORS.map((calculator) => calculator.id)).toEqual(
      CALCULATOR_IDS,
    );

    for (const calculator of CALCULATORS) {
      for (const localized of [
        calculator.title,
        calculator.summary,
        calculator.formulaExplanation,
        calculator.workedExample,
        calculator.interpretation,
        calculator.commonMistake,
        calculator.relatedLesson.label,
      ]) {
        expect(Object.keys(localized).sort()).toEqual(["de", "en", "sl"]);
        expect(
          Object.values(localized).every((text) => text.trim().length > 0),
        ).toBe(true);
      }
      expect(calculator.formula).not.toBe("");
      expect(calculator.relatedLesson.id).toMatch(/^lesson-/);
      expect(calculator.inputs.length).toBeGreaterThan(0);
      expect(calculator.outputs.length).toBeGreaterThan(0);
    }
  });

  it("produces finite default outputs for every displayed calculator", () => {
    for (const calculator of CALCULATORS) {
      const outcome = calculateTool(calculator.id, defaultInputs(calculator));
      expect(outcome.ok, calculator.id).toBe(true);
      if (!outcome.ok) continue;
      expect(
        Object.values(outcome.values).every((value) => Number.isFinite(value)),
        calculator.id,
      ).toBe(true);
    }
  });
});

describe("localized numeric parsing and validation", () => {
  it("accepts decimal comma without accepting loose JavaScript number syntax", () => {
    expect(parseLocalizedNumber("1,25")).toBe(1.25);
    expect(parseLocalizedNumber("  -2.5e2 ")).toBe(-250);
    expect(parseLocalizedNumber("12abc")).toBeNull();
    expect(parseLocalizedNumber("Infinity")).toBeNull();
    expect(parseLocalizedNumber("1,2,3")).toBeNull();
  });

  it("reports missing, non-numeric, bounded, integer, and relational errors", () => {
    expect(
      calculateTool("position-size", {
        account: "",
        riskPercent: "1",
        entry: "100",
        stop: "99",
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "required", field: "account" }],
    });
    expect(
      calculateTool("position-size", {
        account: "lots",
        riskPercent: "1",
        entry: "100",
        stop: "99",
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalidNumber", field: "account" }],
    });
    expect(
      calculateTool("position-size", {
        account: "10000",
        riskPercent: "101",
        entry: "100",
        stop: "99",
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "maximum", field: "riskPercent", limit: 100 }],
    });
    expect(
      calculateTool("compound-interest", {
        principal: "1000",
        annualRate: "5",
        years: "3",
        compounds: "2.5",
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "integer", field: "compounds" }],
    });
    expect(
      calculateTool("reward-risk", { entry: "100", stop: "98", target: "95" }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "oppositeSides", field: "target" }],
    });
    expect(
      calculateTool("basic-dcf", {
        currentFcf: "100",
        growthRate: "5",
        years: "5",
        discountRate: "2",
        terminalGrowth: "2",
      }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "discountAboveGrowth", field: "discountRate" }],
    });
  });
});

describe("trading calculators", () => {
  it("calculates position size and both long and short R multiples", () => {
    expect(valuesFor("position-size").units).toBeCloseTo(200, 10);
    expect(valuesFor("r-multiple").rMultiple).toBeCloseTo(2.5, 10);
    expect(
      valuesFor("r-multiple", { entry: "100", stop: "102", exit: "95" })
        .rMultiple,
    ).toBeCloseTo(2.5, 10);
  });

  it("calculates reward:risk, expectancy, profit factor, and break-even rate", () => {
    expect(valuesFor("reward-risk").ratio).toBeCloseTo(3, 10);
    expect(valuesFor("expectancy").expectancy).toBeCloseTo(0.35, 10);
    expect(valuesFor("profit-factor").profitFactor).toBeCloseTo(1.5, 10);
    expect(valuesFor("break-even-win-rate").breakEvenWinRate).toBeCloseTo(
      33.333333,
      5,
    );
  });

  it("calculates drawdown recovery and leverage consistently", () => {
    expect(valuesFor("drawdown")).toMatchObject({
      drawdownPercent: 20,
      recoveryPercent: 25,
    });
    expect(valuesFor("leverage-margin")).toMatchObject({
      leverage: 5,
      marginPercent: 20,
    });
  });

  it("preserves position-size monotonicity at validated boundaries", () => {
    const base = valuesFor("position-size", {
      account: "10000",
      riskPercent: "1",
      entry: "100",
      stop: "99",
    }).units;
    const doubledRisk = valuesFor("position-size", {
      account: "10000",
      riskPercent: "2",
      entry: "100",
      stop: "99",
    }).units;
    const doubledDistance = valuesFor("position-size", {
      account: "10000",
      riskPercent: "1",
      entry: "100",
      stop: "98",
    }).units;

    expect(doubledRisk).toBeCloseTo(base * 2, 10);
    expect(doubledDistance).toBeCloseTo(base / 2, 10);
  });
});

describe("finance calculators", () => {
  it("calculates time-value formulas including the zero-rate annuity branch", () => {
    expect(valuesFor("compound-interest").futureValue).toBeCloseTo(1157.625, 8);
    expect(valuesFor("present-value").presentValue).toBeCloseTo(1000, 6);
    expect(valuesFor("future-value").futureValue).toBeCloseTo(1472.875, 6);
    expect(valuesFor("future-value", { rate: "0" }).futureValue).toBeCloseTo(
      1300,
      10,
    );
    expect(valuesFor("npv").npv).toBeCloseTo(-5.2592036, 5);
  });

  it("solves conventional IRR within a bounded interval and exposes honest error states", () => {
    const solved = solveIrr([-1000, 400, 400, 400]);
    expect(solved.ok).toBe(true);
    if (solved.ok) {
      expect(solved.rate).toBeCloseTo(0.0970103, 6);
      expect(npvAtRate([-1000, 400, 400, 400], solved.rate)).toBeCloseTo(0, 6);
    }
    expect(solveIrr([100, 200, 300])).toEqual({
      ok: false,
      code: "cashFlowSigns",
    });
    expect(solveIrr([-100, 230, -132])).toEqual({
      ok: false,
      code: "multipleIrr",
    });
    expect(solveIrr([-1, 1000])).toEqual({ ok: false, code: "irrBracket" });
    expect(
      solveIrr([-1000, 400, 400, 400], { maxIterations: 1, tolerance: 0 }),
    ).toEqual({
      ok: false,
      code: "irrConvergence",
    });
  });

  it("prices a par bond and calculates yield, CAPM, and WACC", () => {
    expect(valuesFor("bond-price").bondPrice).toBeCloseTo(1000, 8);
    expect(valuesFor("yield").currentYield).toBeCloseTo(5.2631579, 6);
    expect(valuesFor("capm").expectedReturn).toBeCloseTo(9, 10);
    expect(valuesFor("wacc").wacc).toBeCloseTo(7.5, 10);
  });

  it("calculates the basic DCF with a stable finite sum", () => {
    expect(valuesFor("basic-dcf").enterpriseValue).toBeCloseTo(1446.21189, 5);
  });
});
