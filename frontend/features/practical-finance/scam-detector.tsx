"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CircleAlert,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button, Surface } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-provider";
import { usePreferences } from "@/features/preferences";
import { academyApi } from "@/lib/api-client";
import { practicalContent, practicalDisclaimer } from "./content";
import { evaluateScam, evidenceFromAttempt } from "./engine";
import { saveDemoAttempt } from "./practical-store";
import type { PracticalAttempt } from "./types";

const copy = {
  de: {
    eyebrow: "Verifizieren vor Vertrauen",
    title: "Scam Detector",
    intro:
      "Markiere konkrete Warnsignale, trenne Verdacht von Beweis und übe eine sichere unabhängige Prüfung.",
    scenario: "Szenario",
    signals: "Welche Elemente sind Warnsignale?",
    explain: "Warum?",
    hint: "Begründe ohne pauschal alles als Betrug zu bezeichnen.",
    check: "Signale prüfen",
    result: "Kalibrierte Auswertung",
    safe: "Sichere nächste Handlung",
    verify: "Unabhängig prüfen",
    next: "Nächstes Szenario",
    passport: "Kompetenzpass",
    error: "Die Auswertung konnte nicht gespeichert werden.",
  },
  sl: {
    eyebrow: "Preveri pred zaupanjem",
    title: "Detektor prevar",
    intro:
      "Označi konkretne opozorilne znake, loči sum od dokaza in vadi varno neodvisno preverjanje.",
    scenario: "Scenarij",
    signals: "Kateri elementi so opozorilni znaki?",
    explain: "Zakaj?",
    hint: "Utemelji brez samodejnega označevanja vsega kot prevaro.",
    check: "Preveri znake",
    result: "Umerjena ocena",
    safe: "Varen naslednji korak",
    verify: "Neodvisno preveri",
    next: "Naslednji scenarij",
    passport: "Kompetenčni potni list",
    error: "Ocene ni bilo mogoče shraniti.",
  },
  en: {
    eyebrow: "Verify before trust",
    title: "Scam Detector",
    intro:
      "Mark concrete warning signals, separate suspicion from proof, and practise safe independent verification.",
    scenario: "Scenario",
    signals: "Which elements are warning signals?",
    explain: "Why?",
    hint: "Explain without automatically calling everything a scam.",
    check: "Check signals",
    result: "Calibrated result",
    safe: "Safe next action",
    verify: "Verify independently",
    next: "Next scenario",
    passport: "Competence passport",
    error: "The result could not be saved.",
  },
} as const;

type RemoteAttempt = {
  id: string;
  process_score: number;
  feedback: Record<string, unknown>;
  completed_at: string;
};

export function ScamDetector() {
  const { language } = usePreferences();
  const { user } = useAuth();
  const t = copy[language];
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [result, setResult] = useState<PracticalAttempt | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const item = practicalContent.scams[index];

  function reset(next: number) {
    setIndex(next);
    setSelected([]);
    setReasoning("");
    setResult(null);
    setError("");
  }
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }
  async function submit() {
    if (reasoning.trim().length < 20) return;
    setSaving(true);
    setError("");
    const evaluated = evaluateScam(item, selected, reasoning);
    try {
      if (user) {
        const remote = await academyApi<RemoteAttempt>("/practical/attempts", {
          method: "POST",
          body: {
            activity_type: "scam_detector",
            activity_id: item.id,
            content_version: item.version,
            selected_option_id: "pause-and-verify",
            reasoning,
            assumptions: [],
            calculations: {},
            response: { selected_signal_ids: selected },
          },
        });
        evaluated.id = remote.id;
        evaluated.processScore = remote.process_score;
        evaluated.feedback = remote.feedback;
        evaluated.completedAt = remote.completed_at;
      } else saveDemoAttempt(evaluated, evidenceFromAttempt(evaluated));
      setResult(evaluated);
    } catch {
      setError(t.error);
    } finally {
      setSaving(false);
    }
  }
  const missed = new Set(
    (result?.feedback.missed_signal_ids ??
      result?.feedback.missedSignalIds ??
      []) as string[],
  );
  const incorrect = new Set(
    (result?.feedback.incorrect_signal_ids ??
      result?.feedback.incorrectSignalIds ??
      []) as string[],
  );
  return (
    <>
      <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.intro} />
      <p className="mb-5 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm leading-6">
        <CircleAlert className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
        {practicalDisclaimer[language]}
      </p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Surface as="article" padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-[var(--brand)]">
              {t.scenario} {index + 1} / {practicalContent.scams.length}
            </p>
            <span className="rounded-full bg-[var(--surface-3)] px-3 py-1 text-xs font-semibold">
              {item.difficulty}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold">
            {item.title[language]}
          </h2>
          <blockquote className="mt-4 rounded-[var(--radius-sm)] border-l-4 border-[var(--warning)] bg-[var(--surface-2)] p-5 leading-7">
            {item.message[language]}
          </blockquote>
          <fieldset className="mt-6" disabled={Boolean(result)}>
            <legend className="font-semibold">{t.signals}</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {item.signals.map((signal) => {
                const state = result
                  ? signal.red_flag
                    ? "correct"
                    : incorrect.has(signal.id)
                      ? "incorrect"
                      : "neutral"
                  : "open";
                return (
                  <label
                    key={signal.id}
                    className={`rounded-[var(--radius-sm)] border p-4 ${selected.includes(signal.id) ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-2)]"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(signal.id)}
                      onChange={() => toggle(signal.id)}
                      className="mr-3 accent-[var(--brand)]"
                    />
                    <span className="font-semibold">
                      {signal.text[language]}
                    </span>
                    {result ? (
                      <span
                        className={`mt-2 block text-sm leading-6 ${state === "incorrect" ? "text-[var(--negative)]" : "text-[var(--text-secondary)]"}`}
                      >
                        {signal.rationale[language]}
                        {missed.has(signal.id) ? " · Missed" : ""}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <label className="mt-5 block text-sm font-semibold">
            {t.explain}
            <textarea
              rows={4}
              disabled={Boolean(result)}
              value={reasoning}
              onChange={(event) => setReasoning(event.target.value)}
              placeholder={t.hint}
              className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 font-normal"
            />
          </label>
          {!result ? (
            <Button
              className="mt-5"
              loading={saving}
              disabled={reasoning.trim().length < 20}
              onClick={() => void submit()}
            >
              <SearchCheck size={17} aria-hidden="true" />
              {t.check}
            </Button>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-[var(--negative)]">
              {error}
            </p>
          ) : null}
          {result ? (
            <div
              aria-live="polite"
              className="mt-5 rounded-[var(--radius-sm)] border border-[var(--positive)] bg-[var(--positive-soft)] p-5"
            >
              <p className="text-sm font-semibold text-[var(--positive)]">
                {t.result}
              </p>
              <p className="numeric mt-1 text-4xl font-semibold">
                {result.processScore}%
              </p>
              <h3 className="mt-4 font-semibold">{t.safe}</h3>
              <p className="mt-2 text-sm leading-6">
                {item.safe_action[language]}
              </p>
              <h3 className="mt-4 font-semibold">{t.verify}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {item.verification_checks.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Surface>
        <aside className="h-fit rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background-raised)] p-4 lg:sticky lg:top-24">
          <ShieldAlert className="text-[var(--warning)]" aria-hidden="true" />
          <h2 className="mt-3 font-semibold">Risk is not proof</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            A warning signal changes what you verify and whether you pause. It
            does not justify unsupported accusations.
          </p>
          {result ? (
            <div className="mt-5 grid gap-2">
              <Button
                onClick={() =>
                  reset((index + 1) % practicalContent.scams.length)
                }
              >
                {t.next}
              </Button>
              <Link
                href="/passport"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 text-sm font-semibold"
              >
                <ShieldCheck size={16} aria-hidden="true" />
                {t.passport}
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
