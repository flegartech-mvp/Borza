import type {
  CompetenceEvidence,
  DecisionCase,
  LifeOption,
  LifeRound,
  LifeState,
  PracticalAttempt,
  Quality,
  ScamScenario,
} from "./types";

const qualityScores: Record<Quality, number> = {
  strong: 78,
  reasonable: 62,
  weak: 38,
  dangerous: 18,
};

const effectKeys: Record<string, keyof LifeState> = {
  income: "monthly_income",
  costs: "monthly_costs",
  savings: "savings",
  debt: "debt",
  investments: "investments",
  stress: "stress",
  risk: "risk_exposure",
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function scoreQuality(
  quality: Quality,
  reasoning: string,
  hasCalculations: boolean,
) {
  return Math.min(
    100,
    qualityScores[quality] +
      Math.min(8, Math.floor(reasoning.trim().length / 80)) +
      (hasCalculations ? 7 : 0),
  );
}

function attempt(
  input: Omit<PracticalAttempt, "id" | "completedAt">,
): PracticalAttempt {
  return { ...input, id: uid(), completedAt: new Date().toISOString() };
}

export function evidenceFromAttempt(
  value: PracticalAttempt,
): CompetenceEvidence[] {
  return value.competenceIds.map((competenceId) => ({
    id: uid(),
    competenceId,
    sourceType: value.activityType,
    sourceId: value.id,
    contentVersion: value.contentVersion,
    score: value.processScore,
    summary: `${value.activityType.replaceAll("_", " ")} process evidence`,
    createdAt: value.completedAt,
  }));
}

export function evaluateDecision(
  item: DecisionCase,
  optionId: string,
  reasoning: string,
  calculations: Record<string, number>,
): PracticalAttempt {
  const option = item.options.find((value) => value.id === optionId);
  if (!option) throw new Error("Unknown decision option");
  return attempt({
    activityType: "decision_lab",
    activityId: item.id,
    contentVersion: item.version,
    selectedOptionId: optionId,
    reasoning,
    processScore: scoreQuality(
      option.quality,
      reasoning,
      Object.keys(calculations).length > 0,
    ),
    feedback: {
      quality: option.quality,
      message: option.feedback,
      reflection: item.reflection,
      missingInformation: item.missing_information,
      nextAction: item.next_action,
    },
    competenceIds: item.objectives,
  });
}

export function evaluateScam(
  item: ScamScenario,
  selectedSignalIds: string[],
  reasoning: string,
): PracticalAttempt {
  const expected = new Set(
    item.signals.filter((signal) => signal.red_flag).map((signal) => signal.id),
  );
  const selected = new Set(selectedSignalIds);
  const correct = selectedSignalIds.filter((id) => expected.has(id)).length;
  const precision = selected.size ? correct / selected.size : 0;
  const recall = expected.size ? correct / expected.size : 1;
  const score = Math.min(
    100,
    Math.round(70 * ((precision + recall) / 2)) +
      15 +
      Math.min(10, Math.floor(reasoning.trim().length / 80)),
  );
  return attempt({
    activityType: "scam_detector",
    activityId: item.id,
    contentVersion: item.version,
    selectedOptionId: "pause-and-verify",
    reasoning,
    processScore: score,
    feedback: {
      riskLevel: item.risk_level,
      missedSignalIds: [...expected].filter((id) => !selected.has(id)),
      incorrectSignalIds: [...selected].filter((id) => !expected.has(id)),
      safeAction: item.safe_action,
      checks: item.verification_checks,
      nextAction: item.next_action,
    },
    competenceIds: item.competences,
  });
}

export function applyLifeDecision(
  state: LifeState,
  round: LifeRound,
  optionId: string,
  reasoning: string,
  calculations: Record<string, number> = {},
): { state: LifeState; attempt: PracticalAttempt } {
  const option = round.options.find((value) => value.id === optionId);
  if (!option) throw new Error("Unknown life decision option");
  const next = { ...state };
  for (const [effect, value] of Object.entries(option.effects)) {
    const key = effectKeys[effect];
    if (key) next[key] = Number((next[key] + value).toFixed(2));
  }
  next.savings = Math.max(0, next.savings);
  next.debt = Math.max(0, next.debt);
  next.stress = Math.min(100, Math.max(0, next.stress));
  next.risk_exposure = Math.min(100, Math.max(0, next.risk_exposure));
  return {
    state: next,
    attempt: attempt({
      activityType: "life_simulator",
      activityId: round.id,
      contentVersion: "2026.08",
      selectedOptionId: option.id,
      reasoning,
      processScore: scoreQuality(
        option.quality,
        reasoning,
        Object.keys(calculations).length > 0,
      ),
      feedback: {
        quality: option.quality,
        message: option.feedback,
        nextAction: option.next_action,
      },
      competenceIds: round.competences,
    }),
  };
}

export function optionQuality(option: LifeOption) {
  return qualityScores[option.quality];
}
