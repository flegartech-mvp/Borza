import { describe, expect, it, vi } from "vitest";
import { practicalContent } from "./content";
import {
  applyLifeDecision,
  evaluateDecision,
  evaluateScam,
  evidenceFromAttempt,
} from "./engine";

describe("practical finance engine", () => {
  it("applies canonical life effects without allowing negative liquid balances", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "attempt-1" });
    const profile = practicalContent.life.profiles.find(
      (item) => item.id === "first-job-renter",
    )!;
    const round = practicalContent.life.rounds[0];
    const result = applyLifeDecision(
      profile.state,
      round,
      "stable",
      "Predictable income protects the emergency reserve while it is small.",
    );
    expect(result.state.stress).toBe(profile.state.stress - 5);
    expect(result.state.risk_exposure).toBe(profile.state.risk_exposure - 8);
    expect(result.attempt.processScore).toBeGreaterThanOrEqual(78);
    expect(profile.state.stress).toBe(38);
    vi.unstubAllGlobals();
  });

  it("scores decision process separately from the financial outcome", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "attempt-2" });
    const item = practicalContent.decisions[0];
    const strong = evaluateDecision(
      item,
      "diagnose-repair",
      "I verified the repair life, total cost, and liquidity after the decision.",
      { totalCost: 1400 },
    );
    const dangerous = evaluateDecision(
      item,
      "monthly-only",
      "The advertised monthly payment is the only number I would compare here.",
      {},
    );
    expect(strong.processScore).toBeGreaterThan(dangerous.processScore);
    expect(strong.feedback).toHaveProperty("missingInformation");
    vi.unstubAllGlobals();
  });

  it("penalises both missed and falsely selected scam signals", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "attempt-3" });
    const item = practicalContent.scams.find(
      (scenario) => scenario.id === "hidden-bnpl-cost",
    )!;
    const exact = evaluateScam(
      item,
      ["zero-today"],
      "I would calculate total payable and read the cancellation and late-fee terms.",
    );
    const overselected = evaluateScam(
      item,
      ["zero-today", "terms-available"],
      "I would mark every feature as fraudulent without distinguishing neutral evidence.",
    );
    expect(exact.processScore).toBeGreaterThan(overselected.processScore);
    expect(overselected.feedback.incorrectSignalIds).toEqual([
      "terms-available",
    ]);
    expect(evidenceFromAttempt(exact)).toHaveLength(item.competences.length);
    vi.unstubAllGlobals();
  });
});
