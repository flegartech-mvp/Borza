"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CircleAlert, RotateCcw, WalletCards } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button, Surface } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-provider";
import { usePreferences } from "@/features/preferences";
import { academyApi } from "@/lib/api-client";
import { practicalContent, practicalDisclaimer } from "./content";
import { applyLifeDecision, evidenceFromAttempt } from "./engine";
import {
  saveDemoAttempt,
  saveDemoLifeSession,
  usePracticalDemoState,
} from "./practical-store";
import type { DemoLifeSession, LifeState, PracticalAttempt } from "./types";

const copy = {
  de: {
    eyebrow: "Praktische Finanzkompetenz · Slowenien",
    title: "Lebenssimulator",
    intro:
      "Triff acht Entscheidungen über 24 simulierte Monate. Begründung und Risikodisziplin zählen mehr als das höchste Endvermögen.",
    choose: "Wähle ein Lebensprofil",
    start: "Simulation starten",
    round: "Entscheidung",
    month: "Monat",
    reasoning: "Begründe deine Entscheidung",
    reasoningHint:
      "Nenne Annahme, Risiko und einen Prüfschritt (mindestens 20 Zeichen).",
    decide: "Entscheidung auswerten",
    feedback: "Konsequenz und Reflexion",
    next: "Nächste Entscheidung",
    finish: "Kompetenzpass ansehen",
    reset: "Neues Profil",
    saved: "Im Lernkonto gespeichert",
    local: "Nur in diesem Browser gespeichert",
    error: "Die Entscheidung konnte nicht gespeichert werden.",
  },
  sl: {
    eyebrow: "Praktične finančne veščine · Slovenija",
    title: "Življenjski simulator",
    intro:
      "Sprejmi osem odločitev v 24 simuliranih mesecih. Utemeljitev in disciplina tveganja štejeta več kot najvišje končno premoženje.",
    choose: "Izberi življenjski profil",
    start: "Začni simulacijo",
    round: "Odločitev",
    month: "Mesec",
    reasoning: "Utemelji svojo odločitev",
    reasoningHint:
      "Navedi predpostavko, tveganje in korak preverjanja (najmanj 20 znakov).",
    decide: "Oceni odločitev",
    feedback: "Posledica in refleksija",
    next: "Naslednja odločitev",
    finish: "Poglej kompetenčni potni list",
    reset: "Nov profil",
    saved: "Shranjeno v učnem računu",
    local: "Shranjeno samo v tem brskalniku",
    error: "Odločitve ni bilo mogoče shraniti.",
  },
  en: {
    eyebrow: "Practical financial competence · Slovenia",
    title: "Life Simulator",
    intro:
      "Make eight decisions across 24 simulated months. Reasoning and risk discipline matter more than the highest ending wealth.",
    choose: "Choose a life profile",
    start: "Start simulation",
    round: "Decision",
    month: "Month",
    reasoning: "Explain your decision",
    reasoningHint:
      "Name an assumption, a risk, and a verification step (at least 20 characters).",
    decide: "Evaluate decision",
    feedback: "Consequence and reflection",
    next: "Next decision",
    finish: "View competence passport",
    reset: "New profile",
    saved: "Saved to learning account",
    local: "Saved only in this browser",
    error: "The decision could not be saved.",
  },
} as const;

type RemoteLifeSession = {
  id: string;
  profile_id: string;
  scenario_id: string;
  scenario_version: string;
  status: "active" | "completed";
  current_round: number;
  financial_state: LifeState;
  decision_history: Array<{ process_score: number }>;
  process_score: number;
};

export function LifeSimulator() {
  const { language } = usePreferences();
  const { user } = useAuth();
  const demo = usePracticalDemoState();
  const t = copy[language];
  const scenario = practicalContent.life;
  const [profileId, setProfileId] = useState(scenario.profiles[0].id);
  const [session, setSession] = useState<DemoLifeSession | null>(() =>
    user
      ? null
      : (demo.lifeSessions.find((item) => item.status === "active") ?? null),
  );
  const [selected, setSelected] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [feedback, setFeedback] = useState<PracticalAttempt | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const profile = scenario.profiles.find((item) => item.id === profileId)!;
  const round = session
    ? scenario.rounds[
        feedback ? Math.max(0, session.currentRound - 1) : session.currentRound
      ]
    : undefined;

  const processScore = useMemo(() => {
    if (!session?.decisions.length) return 0;
    return Math.round(
      session.decisions.reduce((sum, item) => sum + item.processScore, 0) /
        session.decisions.length,
    );
  }, [session]);

  async function start() {
    setSaving(true);
    setError("");
    try {
      if (user) {
        const remote = await academyApi<RemoteLifeSession>(
          "/practical/life-sessions",
          { method: "POST", body: { profile_id: profileId } },
        );
        setSession({
          id: remote.id,
          profileId: remote.profile_id,
          scenarioId: remote.scenario_id,
          scenarioVersion: remote.scenario_version,
          currentRound: remote.current_round,
          status: remote.status,
          financialState: remote.financial_state,
          decisions: [],
        });
      } else {
        const local: DemoLifeSession = {
          id: crypto.randomUUID(),
          profileId,
          scenarioId: scenario.id,
          scenarioVersion: scenario.version,
          currentRound: 0,
          status: "active",
          financialState: { ...profile.state },
          decisions: [],
        };
        saveDemoLifeSession(local);
        setSession(local);
      }
    } catch {
      setError(t.error);
    } finally {
      setSaving(false);
    }
  }

  async function decide() {
    if (!session || !round || !selected || reasoning.trim().length < 20) return;
    setSaving(true);
    setError("");
    const evaluated = applyLifeDecision(
      session.financialState,
      round,
      selected,
      reasoning,
    );
    try {
      let next: DemoLifeSession;
      if (user) {
        const remote = await academyApi<RemoteLifeSession>(
          `/practical/life-sessions/${session.id}`,
          {
            method: "PUT",
            body: {
              expected_round: session.currentRound,
              selected_option_id: selected,
              reasoning,
              calculations: {},
            },
          },
        );
        next = {
          ...session,
          currentRound: remote.current_round,
          status: remote.status,
          financialState: remote.financial_state,
          decisions: [...session.decisions, evaluated.attempt],
        };
      } else {
        next = {
          ...session,
          currentRound: session.currentRound + 1,
          status:
            session.currentRound + 1 >= scenario.rounds.length
              ? "completed"
              : "active",
          financialState: evaluated.state,
          decisions: [...session.decisions, evaluated.attempt],
        };
        saveDemoAttempt(
          evaluated.attempt,
          evidenceFromAttempt(evaluated.attempt),
        );
        saveDemoLifeSession(next);
      }
      setSession(next);
      setFeedback(evaluated.attempt);
    } catch {
      setError(t.error);
    } finally {
      setSaving(false);
    }
  }

  function continueSimulation() {
    setSelected("");
    setReasoning("");
    setFeedback(null);
  }

  return (
    <>
      <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.intro} />
      <p className="mb-5 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm leading-6">
        <CircleAlert className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
        {practicalDisclaimer[language]}
      </p>

      {!session ? (
        <section aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="text-xl font-semibold">
            {t.choose}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {scenario.profiles.map((item) => (
              <label
                key={item.id}
                className={`cursor-pointer rounded-[var(--radius-md)] border p-5 ${profileId === item.id ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)]"}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="profile"
                  value={item.id}
                  checked={profileId === item.id}
                  onChange={() => setProfileId(item.id)}
                />
                <span className="font-semibold">{item.title[language]}</span>
                <span className="mt-2 block text-sm leading-6 text-[var(--text-secondary)]">
                  {item.subtitle[language]}
                </span>
                <span className="numeric mt-4 block text-sm">
                  €{item.state.monthly_income.toLocaleString(language)} / month
                  · €{item.state.savings.toLocaleString(language)} liquid
                </span>
              </label>
            ))}
          </div>
          <Button
            className="mt-5"
            size="lg"
            loading={saving}
            onClick={() => void start()}
          >
            <WalletCards size={18} aria-hidden="true" />
            {t.start}
          </Button>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.15em] text-[var(--brand)]">
                  {
                    scenario.profiles.find(
                      (item) => item.id === session.profileId,
                    )?.title[language]
                  }
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {session.status === "completed"
                    ? `${scenario.rounds.length} / ${scenario.rounds.length}`
                    : `${t.round} ${feedback ? session.currentRound : session.currentRound + 1} / ${scenario.rounds.length}`}
                </p>
              </div>
              <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">
                {user ? t.saved : t.local}
              </span>
            </div>

            {session.status === "completed" ? (
              <Surface padding="lg" className="academy-grid">
                <p className="text-sm font-semibold text-[var(--positive)]">
                  Complete
                </p>
                <h2 className="mt-2 text-3xl font-semibold">
                  Process score {processScore}%
                </h2>
                <p className="mt-3 max-w-2xl leading-7 text-[var(--text-secondary)]">
                  {scenario.description[language]}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 font-semibold text-[var(--brand-contrast)]"
                    href="/passport"
                  >
                    {t.finish} <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <Button variant="secondary" onClick={() => setSession(null)}>
                    <RotateCcw size={16} aria-hidden="true" /> {t.reset}
                  </Button>
                </div>
              </Surface>
            ) : round ? (
              <Surface as="article" padding="lg">
                <p className="text-xs font-semibold uppercase tracking-[.15em] text-[var(--electric)]">
                  {t.month} {round.month} ·{" "}
                  {round.category.replaceAll("_", " ")}
                </p>
                <h2 className="mt-3 text-2xl font-semibold">
                  {round.title[language]}
                </h2>
                <p className="mt-3 leading-7 text-[var(--text-secondary)]">
                  {round.situation[language]}
                </p>
                <fieldset className="mt-6" disabled={Boolean(feedback)}>
                  <legend className="font-semibold">
                    {round.prompt[language]}
                  </legend>
                  <div className="mt-3 grid gap-3">
                    {round.options.map((option) => (
                      <label
                        key={option.id}
                        className={`cursor-pointer rounded-[var(--radius-sm)] border p-4 ${selected === option.id ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-2)]"}`}
                      >
                        <input
                          type="radio"
                          name="life-option"
                          className="mr-3 accent-[var(--brand)]"
                          checked={selected === option.id}
                          onChange={() => setSelected(option.id)}
                        />
                        <span className="font-semibold">
                          {option.title[language]}
                        </span>
                        <span className="mt-2 block pl-7 text-sm leading-6 text-[var(--text-secondary)]">
                          {option.summary[language]}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="mt-5 block text-sm font-semibold">
                  {t.reasoning}
                  <textarea
                    value={reasoning}
                    onChange={(event) => setReasoning(event.target.value)}
                    disabled={Boolean(feedback)}
                    rows={4}
                    className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 font-normal"
                    placeholder={t.reasoningHint}
                  />
                </label>
                {feedback ? (
                  <div
                    role="status"
                    className="mt-5 rounded-[var(--radius-sm)] border border-[var(--positive)] bg-[var(--positive-soft)] p-4"
                  >
                    <p className="font-semibold">
                      {t.feedback} · {feedback.processScore}%
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      {
                        (feedback.feedback.message as Record<string, string>)[
                          language
                        ]
                      }
                    </p>
                    <Button className="mt-4" onClick={continueSimulation}>
                      {t.next}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="mt-5"
                    disabled={!selected || reasoning.trim().length < 20}
                    loading={saving}
                    onClick={() => void decide()}
                  >
                    {t.decide}
                  </Button>
                )}
                {error ? (
                  <p
                    role="alert"
                    className="mt-3 text-sm text-[var(--negative)]"
                  >
                    {error}
                  </p>
                ) : null}
              </Surface>
            ) : null}
          </section>
          <LifeIndicators
            state={session.financialState}
            score={processScore}
            language={language}
          />
        </div>
      )}

      <details className="mt-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
        <summary className="cursor-pointer font-semibold">
          Assumptions · {scenario.assumption_date}
        </summary>
        <ul className="mt-3 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
          {scenario.assumptions.map((assumption) => (
            <li key={assumption.id}>
              {assumption.label[language]}
              {assumption.source ? (
                <>
                  {" "}
                  <a
                    className="text-[var(--brand)] underline"
                    href={assumption.source}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Source
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

function LifeIndicators({
  state,
  score,
  language,
}: {
  state: LifeState;
  score: number;
  language: string;
}) {
  const margin =
    state.monthly_income - state.monthly_costs - state.monthly_debt_payment;
  const items = [
    ["Monthly margin", margin, "€"],
    ["Liquid savings", state.savings, "€"],
    ["Debt", state.debt, "€"],
    ["Investments", state.investments, "€"],
    ["Stress", state.stress, "%"],
    ["Risk exposure", state.risk_exposure, "%"],
    ["Process", score, "%"],
  ] as const;
  return (
    <aside
      className="h-fit rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--background-raised)] p-5 xl:sticky xl:top-24"
      aria-label="Simulation indicators"
    >
      <h2 className="font-semibold">Financial state</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {items.map(([label, value, unit]) => (
          <div
            key={label}
            className="rounded-[var(--radius-sm)] bg-[var(--surface-1)] p-3"
          >
            <dt className="text-xs text-[var(--text-tertiary)]">{label}</dt>
            <dd
              className={`numeric mt-1 text-lg font-semibold ${label === "Debt" && value > 0 ? "text-[var(--negative)]" : ""}`}
            >
              {unit === "€" ? "€" : ""}
              {value.toLocaleString(language)}
              {unit === "%" ? "%" : ""}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
