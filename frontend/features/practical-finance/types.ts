import type { LocalizedText } from "@/lib/academy-types";

export type Quality = "strong" | "reasonable" | "weak" | "dangerous";

export type CompetenceDefinition = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  next_action: string;
};

export type LifeState = {
  monthly_income: number;
  monthly_costs: number;
  savings: number;
  debt: number;
  monthly_debt_payment: number;
  investments: number;
  stress: number;
  risk_exposure: number;
};

export type LifeOption = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  quality: Quality;
  effects: Record<string, number>;
  feedback: LocalizedText;
  next_action: string;
};

export type LifeRound = {
  id: string;
  month: number;
  category: string;
  title: LocalizedText;
  situation: LocalizedText;
  prompt: LocalizedText;
  competences: string[];
  options: LifeOption[];
};

export type LifeProfile = {
  id: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  goal: string;
  risk_tolerance: string;
  state: LifeState;
};

export type LifeScenario = {
  id: string;
  version: string;
  title: LocalizedText;
  description: LocalizedText;
  assumption_date: string;
  assumptions: Array<{
    id: string;
    label: LocalizedText;
    source?: string;
  }>;
  profiles: LifeProfile[];
  rounds: LifeRound[];
};

export type DecisionOption = {
  id: string;
  quality: Quality;
  label: LocalizedText;
  feedback: LocalizedText;
};

export type DecisionCase = {
  id: string;
  version: string;
  difficulty: string;
  title: LocalizedText;
  context: LocalizedText;
  objectives: string[];
  financial_data: Record<string, number>;
  missing_information: string[];
  required_calculations: string[];
  risks: string[];
  options: DecisionOption[];
  reflection: LocalizedText;
  next_action: string;
  teacher_mode: boolean;
};

export type ScamSignal = {
  id: string;
  red_flag: boolean;
  text: LocalizedText;
  rationale: LocalizedText;
};

export type ScamScenario = {
  id: string;
  version: string;
  difficulty: string;
  title: LocalizedText;
  message: LocalizedText;
  risk_level: "low" | "medium" | "high" | "critical";
  competences: string[];
  signals: ScamSignal[];
  safe_action: LocalizedText;
  verification_checks: string[];
  next_action: string;
};

export type ClassroomActivity = {
  id: string;
  version: string;
  kind: string;
  duration_options: number[];
  recommended_age: string;
  title: LocalizedText;
  summary: LocalizedText;
  objectives: string[];
  material: string;
  anonymous_mode: boolean;
};

export type PracticalAttempt = {
  id: string;
  activityType: "life_simulator" | "scam_detector" | "decision_lab";
  activityId: string;
  contentVersion: string;
  selectedOptionId: string;
  reasoning: string;
  processScore: number;
  feedback: Record<string, unknown>;
  competenceIds: string[];
  completedAt: string;
};

export type CompetenceEvidence = {
  id: string;
  competenceId: string;
  sourceType: PracticalAttempt["activityType"];
  sourceId: string;
  contentVersion: string;
  score: number;
  summary: string;
  createdAt: string;
};

export type DemoLifeSession = {
  id: string;
  profileId: string;
  scenarioId: string;
  scenarioVersion: string;
  currentRound: number;
  status: "active" | "completed";
  financialState: LifeState;
  decisions: PracticalAttempt[];
};

export type DemoClassroomResponse = {
  participantId: string;
  itemId: string;
  selectedOptionId: string;
  processScore: number;
  misconceptions: string[];
};

export type DemoClassroom = {
  id: string;
  code: string;
  activityId: string;
  activityType: string;
  contentVersion: string;
  durationMinutes: 45 | 90;
  status: "active" | "closed";
  participantCount: number;
  responses: DemoClassroomResponse[];
  createdAt: string;
};
