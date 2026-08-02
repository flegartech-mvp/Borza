"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, CircleX, RotateCcw } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui";
import { ChartLoader } from "@/features/charts/chart-loader";
import { useDemoWorkspace, type QuizSubmissionResult } from "@/features/demo/demo-workspace-provider";
import { usePreferences } from "@/features/preferences";
import type { AcademyQuiz, AcademyQuizQuestion, LocalizedText } from "@/lib/academy-types";
import { DEMO_CANDLES, DEMO_LESSON, DEMO_QUIZ } from "@/lib/demo-academy";
import { useQuiz } from "./use-academy-content";

const copy = {
  de: { intro: "Klare Fragen prüfen Verständnis ohne Tricks.", order: "Reihenfolge", moveUp: "Nach oben", moveDown: "Nach unten", selectMatch: "Zuordnung wählen", number: "Numerische Antwort", reflection: "Begründe deine Entscheidung in mindestens vier Wörtern.", scenario: "Szenario-Kontext", chart: "Simulierter Chart-Kontext", answered: "beantwortet", retry: "Nochmal bearbeiten", signIn: "Melde dich an, um weitere Katalog-Quizzes serverseitig auszuwerten.", failed: "Das Quiz konnte nicht ausgewertet werden.", review: "Diese Karte wird zur Wiederholung empfohlen." },
  sl: { intro: "Jasna vprašanja preverijo razumevanje brez trikov.", order: "Vrstni red", moveUp: "Premakni gor", moveDown: "Premakni dol", selectMatch: "Izberi povezavo", number: "Številčni odgovor", reflection: "Odločitev utemelji z vsaj štirimi besedami.", scenario: "Kontekst scenarija", chart: "Simuliran kontekst grafa", answered: "odgovorjeno", retry: "Poskusi znova", signIn: "Prijavi se za strežniško ocenjevanje drugih kvizov iz kataloga.", failed: "Kviza ni bilo mogoče oceniti.", review: "Ta pojem je priporočen za ponavljanje." },
  en: { intro: "Clear questions test understanding without tricks.", order: "Order", moveUp: "Move up", moveDown: "Move down", selectMatch: "Choose match", number: "Numerical answer", reflection: "Explain your decision in at least four words.", scenario: "Scenario context", chart: "Simulated chart context", answered: "answered", retry: "Try again", signIn: "Sign in to score additional catalogue quizzes on the server.", failed: "The quiz could not be scored.", review: "This concept is recommended for review." },
};

function demoQuiz(quizId: string): AcademyQuiz {
  return {
    id: quizId,
    lessonId: DEMO_LESSON.id,
    questions: DEMO_QUIZ.map((question) => ({ id: question.id, lessonId: DEMO_LESSON.id, type: "single_choice", prompt: question.prompt, options: question.options.map((option) => ({ id: option.id, text: option.label })), reviewRecommended: true })),
  };
}

function localized(value: unknown, language: "de" | "sl" | "en"): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidate = (value as Record<string, unknown>)[language];
    if (typeof candidate === "string") return candidate;
    if (Array.isArray(candidate)) return candidate.join(" · ");
  }
  return "";
}

function answered(question: AcademyQuizQuestion, answer: unknown): boolean {
  if (!answer || typeof answer !== "object") return false;
  const value = answer as Record<string, unknown>;
  if (question.type === "multiple_choice" || question.type === "single_choice" || question.type === "chart_based" || question.type === "scenario_decision") return Array.isArray(value.selected_option_ids) && value.selected_option_ids.length > 0;
  if (question.type === "numerical" || question.type === "formula_calculation") return typeof value.value === "number" && Number.isFinite(value.value);
  if (question.type === "ordering") return Array.isArray(value.ordered_ids) && value.ordered_ids.length === (question.items?.length ?? 0);
  if (question.type === "matching") {
    if (!value.matches || typeof value.matches !== "object") return false;
    const matches = Object.values(value.matches as Record<string, string>);
    return matches.length === (question.leftItems?.length ?? 0) && matches.every(Boolean) && new Set(matches).size === matches.length;
  }
  if (question.type === "short_reflection") return typeof value.text === "string" && value.text.trim().split(/\s+/).length >= 4 && value.text.trim().length >= 20;
  return false;
}

export function QuizPage({ quizId }: { quizId: string }) {
  const { dictionary, language } = usePreferences();
  const { mode, recordQuizScore } = useDemoWorkspace();
  const query = useQuiz(quizId);
  const quiz = mode === "demo" && (quizId === DEMO_LESSON.id || quizId === "quiz-ff-finance-map") ? demoQuiz(quizId) : query.quiz;
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strings = copy[language];
  const feedback = useMemo(() => new Map(result?.feedback.map((item) => [item.question_id, item])), [result]);
  if (query.isLoading && !quiz) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;
  if (!quiz) return <ErrorState title={dictionary.quiz.title} description={strings.failed} action={<button type="button" onClick={() => void query.refetch()} className="font-semibold text-[var(--brand)]">{dictionary.common.retry}</button>} />;
  const submitted = Boolean(result || demoSubmitted);
  const countAnswered = quiz.questions.filter((question) => answered(question, answers[question.id])).length;
  const demoCorrect = DEMO_QUIZ.filter((question) => {
    const answer = answers[question.id] as { selected_option_ids?: string[] } | undefined;
    return answer?.selected_option_ids?.[0] === question.correctOptionId;
  }).length;
  const correctCount = result?.correct_count ?? demoCorrect;

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      const score = Math.round((demoCorrect / quiz.questions.length) * 100);
      const response = await recordQuizScore(quiz.id, score, quiz.questions.map((question) => ({ question_id: question.id, answer: answers[question.id] })));
      if (response) setResult(response);
      else setDemoSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : strings.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading eyebrow="Borza Academy" title={dictionary.quiz.title} description={strings.intro} />
      {error ? <p role="alert" className="mb-4 rounded-[var(--radius-sm)] border border-[var(--negative)] bg-[var(--negative-soft)] p-4 text-sm text-[var(--negative)]">{error}</p> : null}
      <div className="space-y-5">
        {quiz.questions.map((question, index) => {
          const remoteFeedback = feedback.get(question.id);
          const demoDefinition = DEMO_QUIZ.find((item) => item.id === question.id);
          const demoIsCorrect = demoDefinition ? (answers[question.id] as { selected_option_ids?: string[] } | undefined)?.selected_option_ids?.[0] === demoDefinition.correctOptionId : false;
          const isCorrect = remoteFeedback?.correct ?? demoIsCorrect;
          const explanation = remoteFeedback ? localized(remoteFeedback.explanation, language) : demoDefinition?.explanation[language] ?? "";
          return (
            <section key={question.id} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 sm:p-6">
              <p className="numeric text-xs text-[var(--text-tertiary)]">{index + 1} / {quiz.questions.length} · {question.type.replaceAll("_", " ")}</p>
              <h3 className="mt-3 text-lg font-semibold">{question.prompt[language]}</h3>
              <QuestionControl question={question} answer={answers[question.id]} disabled={submitted} language={language} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />
              {submitted ? <div className={`mt-5 rounded-[var(--radius-sm)] border p-4 ${isCorrect ? "border-[var(--positive)] bg-[var(--positive-soft)]" : "border-[var(--warning)] bg-[var(--warning-soft)]"}`}><p className="flex items-center gap-2 font-semibold">{isCorrect ? <CheckCircle2 aria-hidden="true" size={17} /> : <CircleX aria-hidden="true" size={17} />}{isCorrect ? dictionary.quiz.correct : dictionary.quiz.incorrect}</p>{explanation ? <p className="mt-3 text-sm leading-6"><strong>{dictionary.quiz.explanation}:</strong> {explanation}</p> : mode === "demo" ? <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{strings.signIn}</p> : null}{demoDefinition ? <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]"><strong>{dictionary.quiz.alternatives}:</strong> {demoDefinition.alternatives[language]}</p> : null}{remoteFeedback?.review_recommended || (!isCorrect && question.reviewRecommended) ? <p className="mt-3 text-xs font-semibold text-[var(--warning)]">{strings.review}</p> : null}<Link href={`/lesson/${question.lessonId}`} className="mt-3 inline-flex text-sm font-semibold text-[var(--brand)]">{dictionary.lesson.core}</Link></div> : null}
            </section>
          );
        })}
      </div>
      <div className="sticky bottom-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--surface-1)_95%,transparent)] p-4 shadow-[var(--shadow-floating)] backdrop-blur md:bottom-4"><div>{submitted ? <><p className="text-xs text-[var(--text-tertiary)]">{dictionary.quiz.result}</p><p className="numeric text-xl font-semibold">{correctCount} / {quiz.questions.length}</p></> : <p className="text-sm text-[var(--text-secondary)]">{countAnswered} / {quiz.questions.length} {strings.answered}</p>}</div>{submitted ? <div className="flex gap-2"><Button variant="secondary" onClick={() => { setResult(null); setDemoSubmitted(false); setAnswers({}); }}><RotateCcw aria-hidden="true" size={16} />{strings.retry}</Button><Link href="/review" className="inline-flex min-h-10 items-center rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 font-semibold text-[var(--brand-contrast)]">{dictionary.nav.review}</Link></div> : <Button loading={saving} disabled={countAnswered !== quiz.questions.length} onClick={() => void finish()}>{dictionary.quiz.submit}</Button>}</div>
    </div>
  );
}

function QuestionControl({ question, answer, disabled, language, onChange }: { question: AcademyQuizQuestion; answer: unknown; disabled: boolean; language: "de" | "sl" | "en"; onChange: (answer: unknown) => void }) {
  const strings = copy[language];
  if (question.type === "single_choice" || question.type === "chart_based" || question.type === "scenario_decision") {
    const selected = ((answer as { selected_option_ids?: string[] } | undefined)?.selected_option_ids ?? [])[0];
    return <>{question.type === "chart_based" ? <div className="mt-5"><p className="mb-2 text-xs font-semibold text-[var(--electric)]">{strings.chart}</p><ChartLoader candles={DEMO_CANDLES.slice(0, 32)} label={strings.chart} /></div> : null}{question.type === "scenario_decision" ? <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-xs font-semibold text-[var(--warning)]">{strings.scenario}: {question.scenarioId?.replaceAll("-", " ")}</p> : null}<OptionList groupName={question.id} options={question.options ?? []} selected={[selected]} multiple={false} disabled={disabled} language={language} onChange={(ids) => onChange({ selected_option_ids: ids })} /></>;
  }
  if (question.type === "multiple_choice") {
    const selected = (answer as { selected_option_ids?: string[] } | undefined)?.selected_option_ids ?? [];
    return <OptionList groupName={question.id} options={question.options ?? []} selected={selected} multiple disabled={disabled} language={language} onChange={(ids) => onChange({ selected_option_ids: ids })} />;
  }
  if (question.type === "numerical" || question.type === "formula_calculation") {
    const value = (answer as { value?: number } | undefined)?.value;
    return <label className="mt-5 block text-sm font-semibold">{strings.number}<input disabled={disabled} type="number" step="any" value={value ?? ""} onChange={(event) => onChange({ value: event.target.value === "" ? undefined : Number(event.target.value) })} className="numeric mt-2 min-h-12 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4" /></label>;
  }
  if (question.type === "ordering") {
    const initial = [...(question.items ?? []).map((item) => item.id)].reverse();
    const ordered = (answer as { ordered_ids?: string[] } | undefined)?.ordered_ids ?? initial;
    const move = (itemIndex: number, direction: -1 | 1) => {
      const target = itemIndex + direction;
      if (target < 0 || target >= ordered.length) return;
      const next = [...ordered];
      [next[itemIndex], next[target]] = [next[target], next[itemIndex]];
      onChange({ ordered_ids: next });
    };
    return <div className="mt-5 space-y-2">{ordered.map((id, itemIndex) => { const item = question.items?.find((candidate) => candidate.id === id); return <div key={id} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><span className="numeric grid size-8 place-items-center rounded-full bg-[var(--surface-1)]">{itemIndex + 1}</span><span className="flex-1">{item?.text[language]}</span><button disabled={disabled || itemIndex === 0} type="button" aria-label={strings.moveUp} onClick={() => move(itemIndex, -1)} className="grid size-10 place-items-center rounded-md border border-[var(--border-subtle)] disabled:opacity-40"><ArrowUp aria-hidden="true" size={16} /></button><button disabled={disabled || itemIndex === ordered.length - 1} type="button" aria-label={strings.moveDown} onClick={() => move(itemIndex, 1)} className="grid size-10 place-items-center rounded-md border border-[var(--border-subtle)] disabled:opacity-40"><ArrowDown aria-hidden="true" size={16} /></button></div>; })}<button type="button" disabled={disabled} onClick={() => onChange({ ordered_ids: ordered })} className="sr-only">{strings.order}</button></div>;
  }
  if (question.type === "matching") {
    const matches = (answer as { matches?: Record<string, string> } | undefined)?.matches ?? {};
    const choices = [...(question.rightItems ?? [])].reverse();
    return <div className="mt-5 space-y-3">{(question.leftItems ?? []).map((left) => <label key={left.id} className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center"><span className="font-semibold">{left.text[language]}</span><select disabled={disabled} aria-label={`${strings.selectMatch}: ${left.text[language]}`} value={matches[left.id] ?? ""} onChange={(event) => { const next = { ...matches }; if (event.target.value) next[left.id] = event.target.value; else delete next[left.id]; onChange({ matches: next }); }} className="min-h-11 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3"><option value="">{strings.selectMatch}</option>{choices.map((choice) => <option key={choice.id} value={choice.id} disabled={Object.entries(matches).some(([leftId, rightId]) => leftId !== left.id && rightId === choice.id)}>{choice.text[language]}</option>)}</select></label>)}</div>;
  }
  const text = (answer as { text?: string } | undefined)?.text ?? "";
  return <label className="mt-5 block text-sm font-semibold">{strings.reflection}<textarea disabled={disabled} value={text} onChange={(event) => onChange({ text: event.target.value })} rows={5} className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4" /></label>;
}

export function OptionList({ groupName, options, selected, multiple, disabled, language, onChange }: { groupName: string; options: Array<{ id: string; text: LocalizedText }>; selected: string[]; multiple: boolean; disabled: boolean; language: "de" | "sl" | "en"; onChange: (ids: string[]) => void }) {
  return <fieldset disabled={disabled} className="mt-5 grid gap-2"><legend className="sr-only">{multiple ? "Multiple choice" : "Single choice"}</legend>{options.map((option) => { const checked = selected.includes(option.id); return <label key={option.id} className="cursor-pointer"><input type={multiple ? "checkbox" : "radio"} name={multiple ? undefined : groupName} checked={checked} onChange={() => onChange(multiple ? checked ? selected.filter((id) => id !== option.id) : [...selected, option.id] : [option.id])} className="peer sr-only" /><span className="flex min-h-12 items-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 peer-checked:border-[var(--electric)] peer-checked:bg-[var(--electric-soft)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--electric)]">{option.text[language]}</span></label>; })}</fieldset>;
}
