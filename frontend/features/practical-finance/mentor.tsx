"use client";

import { useState } from "react";
import { BrainCircuit, CircleAlert, Send } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button, Surface } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-provider";
import { usePreferences } from "@/features/preferences";
import { academyApi } from "@/lib/api-client";
import { practicalContent, practicalDisclaimer } from "./content";

const guided = {
  de: {
    question:
      "Welche Annahme trägt deine Entscheidung am stärksten, und wie könntest du sie unabhängig prüfen?",
    prompts: [
      "Welche Zahl oder Information fehlt dir?",
      "Was ist der tragbare Verlust, wenn du falsch liegst?",
      "Welche reversible Alternative kannst du zuerst testen?",
    ],
    note: "Geführter Lernmodus: keine Modellantwort und keine individuelle Finanzberatung.",
  },
  sl: {
    question:
      "Katera predpostavka najbolj vpliva na tvojo odločitev in kako jo lahko neodvisno preveriš?",
    prompts: [
      "Kateri podatek ali informacija ti manjka?",
      "Kolikšna izguba je zate vzdržna, če se motiš?",
      "Katero povratno možnost lahko najprej preizkusiš?",
    ],
    note: "Vodeni učni način: brez odgovora modela in brez osebnega finančnega svetovanja.",
  },
  en: {
    question:
      "Which assumption carries the most weight in your decision, and how could you verify it independently?",
    prompts: [
      "Which number or piece of information is missing?",
      "What loss remains affordable if you are wrong?",
      "Which reversible alternative could you test first?",
    ],
    note: "Guided learning mode: no model response and no personal financial advice.",
  },
} as const;
const copy = {
  de: {
    eyebrow: "Kontrollierter sokratischer Begleiter",
    title: "AI Mentor",
    intro:
      "Der Mentor beantwortet die Entscheidung nicht. Er stellt eine begrenzte Frage zu Annahmen, Berechnungen, Alternativen oder Risiko.",
    context: "Lernkontext",
    message: "Was möchtest du überprüfen?",
    hint: "Beschreibe die Entscheidung ohne Kontodaten oder andere sensible Informationen.",
    ask: "Mentor fragen",
    answer: "Nächste Denkfrage",
    ai: "KI-Modus",
    fallback: "Geführter Modus",
    error:
      "Der optionale Mentor war nicht erreichbar. Geführter Modus wird verwendet.",
  },
  sl: {
    eyebrow: "Nadzorovan sokratski spremljevalec",
    title: "AI mentor",
    intro:
      "Mentor ne sprejme odločitve namesto tebe. Postavi omejeno vprašanje o predpostavkah, izračunih, alternativah ali tveganju.",
    context: "Učni kontekst",
    message: "Kaj želiš preveriti?",
    hint: "Opiši odločitev brez podatkov o računu ali drugih občutljivih informacij.",
    ask: "Vprašaj mentorja",
    answer: "Naslednje vprašanje za razmislek",
    ai: "Način AI",
    fallback: "Vodeni način",
    error: "Izbirni mentor ni bil dosegljiv. Uporabljen je vodeni način.",
  },
  en: {
    eyebrow: "Controlled Socratic companion",
    title: "AI Mentor",
    intro:
      "The mentor does not make the decision. It asks one bounded question about assumptions, calculations, alternatives, or risk.",
    context: "Learning context",
    message: "What would you like to examine?",
    hint: "Describe the decision without account data or other sensitive information.",
    ask: "Ask mentor",
    answer: "Next thinking question",
    ai: "AI mode",
    fallback: "Guided mode",
    error: "The optional mentor was unavailable. Guided mode is being used.",
  },
} as const;
type Response = {
  mode: "ai" | "guided_fallback";
  question: string;
  follow_up_prompts: string[];
  safety_note: string;
  referenced_content_ids: string[];
};

export function Mentor() {
  const { language } = usePreferences();
  const { user } = useAuth();
  const t = copy[language];
  const [contextId, setContextId] = useState(practicalContent.decisions[0].id);
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function ask() {
    if (message.trim().length < 10) return;
    setLoading(true);
    setError("");
    try {
      if (user) {
        setResponse(
          await academyApi<Response>("/practical/mentor", {
            method: "POST",
            body: {
              context_type: "decision_lab",
              context_id: contextId,
              learner_message: message,
              decision_summary:
                practicalContent.decisions.find((item) => item.id === contextId)
                  ?.context[language] ?? "",
              locale: language,
            },
          }),
        );
      } else {
        const local = guided[language];
        setResponse({
          mode: "guided_fallback",
          question: local.question,
          follow_up_prompts: [...local.prompts],
          safety_note: local.note,
          referenced_content_ids: [contextId],
        });
      }
    } catch {
      const local = guided[language];
      setError(t.error);
      setResponse({
        mode: "guided_fallback",
        question: local.question,
        follow_up_prompts: [...local.prompts],
        safety_note: local.note,
        referenced_content_ids: [contextId],
      });
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.intro} />
      <p className="mb-5 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm leading-6">
        <CircleAlert className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
        {practicalDisclaimer[language]}
      </p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Surface padding="lg">
          <label className="block text-sm font-semibold">
            {t.context}
            <select
              value={contextId}
              onChange={(event) => {
                setContextId(event.target.value);
                setResponse(null);
              }}
              className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 font-normal"
            >
              {practicalContent.decisions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title[language]}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-5 block text-sm font-semibold">
            {t.message}
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              maxLength={2000}
              placeholder={t.hint}
              className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 font-normal"
            />
          </label>
          <p className="mt-2 text-right text-xs text-[var(--text-tertiary)]">
            {message.length} / 2000
          </p>
          <Button
            className="mt-4"
            disabled={message.trim().length < 10}
            loading={loading}
            onClick={() => void ask()}
          >
            <Send size={16} aria-hidden="true" />
            {t.ask}
          </Button>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-[var(--warning)]">
              {error}
            </p>
          ) : null}
        </Surface>
        <Surface
          padding="lg"
          aria-live="polite"
          className={response ? "border-[var(--brand)]" : ""}
        >
          <BrainCircuit className="text-[var(--brand)]" aria-hidden="true" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[.15em] text-[var(--brand)]">
            {response?.mode === "ai" ? t.ai : t.fallback}
          </p>
          <h2 className="mt-3 text-xl font-semibold">{t.answer}</h2>
          {response ? (
            <>
              <p className="mt-3 leading-7">{response.question}</p>
              <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                {response.follow_up_prompts.map((prompt) => (
                  <li
                    key={prompt}
                    className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3"
                  >
                    {prompt}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-5 text-[var(--text-tertiary)]">
                {response.safety_note}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {t.intro}
            </p>
          )}
        </Surface>
      </div>
    </>
  );
}
