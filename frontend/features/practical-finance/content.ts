import classroomPayload from "../../../content/academy/classroom_activities.json";
import competencePayload from "../../../content/academy/competences.json";
import decisionPayload from "../../../content/academy/decision_cases.json";
import lifePayload from "../../../content/academy/life_simulator.json";
import scamPayload from "../../../content/academy/scam_scenarios.json";
import type {
  ClassroomActivity,
  CompetenceDefinition,
  DecisionCase,
  LifeScenario,
  ScamScenario,
} from "./types";

export const practicalContent = {
  life: lifePayload.scenario as LifeScenario,
  scams: scamPayload.scenarios as ScamScenario[],
  decisions: decisionPayload.cases as unknown as DecisionCase[],
  competences: competencePayload.competences as CompetenceDefinition[],
  classrooms: classroomPayload.activities as ClassroomActivity[],
};

export const practicalDisclaimer = {
  de: "Lernsimulation, keine individuelle Finanzberatung. Alle Personen und Beträge sind Lernbeispiele.",
  sl: "Učna simulacija, ne osebno finančno svetovanje. Vse osebe in zneski so učni primeri.",
  en: "Learning simulation, not personal financial advice. All people and amounts are educational examples.",
} as const;
