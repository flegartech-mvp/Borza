"use client";

import { useState } from "react";
import { CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui";
import { usePreferences } from "@/features/preferences";
import { MarketingPage } from "@/features/marketing/marketing-shell";
import { academyApi } from "@/lib/api-client";
import { practicalContent } from "./content";
import { evaluateDecision, evaluateScam } from "./engine";
import {
  joinDemoClassroom,
  saveDemoClassroomResponse,
} from "./practical-store";

const copy = {
  de: {
    eyebrow: "Anonyme Klassensitzung",
    title: "Der Klasse beitreten",
    intro:
      "Verwende ein Pseudonym—keinen echten Namen. Teile keine Konten, Schulden, Einkommen oder persönlichen Finanzprobleme.",
    code: "Klassencode",
    alias: "Pseudonym",
    join: "Sicher beitreten",
    notFound: "Keine aktive Klasse mit diesem Code gefunden.",
    activity: "Klassenaktivität",
    reasoning: "Begründe deine Antwort",
    hint: "Nenne Beleg, Annahme und sicheren nächsten Schritt.",
    submit: "Anonym senden",
    done: "Antwort angenommen",
    doneBody:
      "Deine Begründung ist Teil der aggregierten Klassenansicht. Es gibt keine Rangliste.",
    error: "Die Antwort konnte nicht gesendet werden.",
  },
  sl: {
    eyebrow: "Anonimno razredno srečanje",
    title: "Pridruži se razredu",
    intro:
      "Uporabi psevdonim—ne pravega imena. Ne deli računov, dolgov, prihodkov ali osebnih finančnih težav.",
    code: "Koda razreda",
    alias: "Psevdonim",
    join: "Varno se pridruži",
    notFound: "Aktivnega razreda s to kodo ni bilo mogoče najti.",
    activity: "Razredna dejavnost",
    reasoning: "Utemelji odgovor",
    hint: "Navedi dokaz, predpostavko in varen naslednji korak.",
    submit: "Pošlji anonimno",
    done: "Odgovor sprejet",
    doneBody:
      "Tvoja utemeljitev je del združenega pogleda razreda. Lestvice ni.",
    error: "Odgovora ni bilo mogoče poslati.",
  },
  en: {
    eyebrow: "Anonymous classroom session",
    title: "Join the class",
    intro:
      "Use a pseudonym—not your real name. Do not share accounts, debts, income, or personal financial hardship.",
    code: "Class code",
    alias: "Pseudonym",
    join: "Join safely",
    notFound: "No active class was found with that code.",
    activity: "Class activity",
    reasoning: "Explain your answer",
    hint: "Name evidence, an assumption, and a safe next step.",
    submit: "Send anonymously",
    done: "Response accepted",
    doneBody:
      "Your reasoning is part of the aggregate class view. There is no leaderboard.",
    error: "The response could not be sent.",
  },
} as const;
type RemoteJoin = {
  session_id: string;
  participant_id: string;
  participant_token: string;
  activity_type: string;
  activity_id: string;
  content_version: string;
};
type Joined = {
  remote: boolean;
  classroomId: string;
  participantId: string;
  token?: string;
  activityId: string;
  activityType: string;
  contentVersion: string;
};

export function ClassroomJoin({ initialCode }: { initialCode: string }) {
  const { language } = usePreferences();
  const t = copy[language];
  const [code, setCode] = useState(
    initialCode === "DEMO123" ? "" : initialCode.toUpperCase(),
  );
  const [alias, setAlias] = useState("");
  const [joined, setJoined] = useState<Joined | null>(null);
  const [selected, setSelected] = useState("");
  const [signals, setSignals] = useState<string[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const activity = joined
    ? practicalContent.classrooms.find((item) => item.id === joined.activityId)
    : null;
  const scam =
    activity?.kind === "scam-detector" ? practicalContent.scams[0] : null;
  const life =
    activity?.kind === "life-simulator"
      ? practicalContent.life.rounds[0]
      : null;
  const decision = !scam && !life ? practicalContent.decisions[0] : null;
  async function join() {
    setStatus("loading");
    setError("");
    const local = joinDemoClassroom(code);
    if (local) {
      setJoined({
        remote: false,
        classroomId: local.classroom.id,
        participantId: local.participantId,
        activityId: local.classroom.activityId,
        activityType: local.classroom.activityType,
        contentVersion: local.classroom.contentVersion,
      });
      setStatus("idle");
      return;
    }
    try {
      const remote = await academyApi<RemoteJoin>("/classrooms/join", {
        method: "POST",
        body: { classroom_code: code, pseudonym: alias, website: "" },
      });
      setJoined({
        remote: true,
        classroomId: remote.session_id,
        participantId: remote.participant_id,
        token: remote.participant_token,
        activityId: remote.activity_id,
        activityType: remote.activity_type,
        contentVersion: remote.content_version,
      });
      setStatus("idle");
    } catch {
      setError(t.notFound);
      setStatus("idle");
    }
  }
  async function submit() {
    if (!joined || reasoning.trim().length < 10) return;
    setStatus("loading");
    setError("");
    let itemId = "";
    let answer: Record<string, unknown> = {};
    let localScore = 0;
    let misconceptions: string[] = [];
    if (scam) {
      itemId = scam.id;
      answer = {
        selected_signal_ids: signals,
        selected_option_id: "pause-and-verify",
      };
      const result = evaluateScam(scam, signals, reasoning);
      localScore = result.processScore;
      misconceptions = (result.feedback.missedSignalIds ?? []) as string[];
    } else if (life) {
      itemId = life.id;
      answer = { selected_option_id: selected };
      const option = life.options.find((item) => item.id === selected);
      localScore =
        option?.quality === "strong"
          ? 80
          : option?.quality === "reasonable"
            ? 65
            : 30;
      misconceptions =
        option?.quality === "weak" || option?.quality === "dangerous"
          ? [selected]
          : [];
    } else if (decision) {
      itemId = decision.id;
      answer = { selected_option_id: selected };
      const result = evaluateDecision(decision, selected, reasoning, {});
      localScore = result.processScore;
      misconceptions = result.processScore < 50 ? [selected] : [];
    }
    try {
      if (joined.remote) {
        await academyApi(`/classrooms/${joined.classroomId}/responses`, {
          method: "POST",
          headers: { "X-Classroom-Token": joined.token ?? "" },
          body: { item_id: itemId, answer, reasoning, completed: true },
        });
      } else
        saveDemoClassroomResponse(joined.classroomId, {
          participantId: joined.participantId,
          itemId,
          selectedOptionId: scam ? "pause-and-verify" : selected,
          processScore: localScore,
          misconceptions,
        });
      setStatus("done");
    } catch {
      setError(t.error);
      setStatus("idle");
    }
  }
  return (
    <MarketingPage>
      <section className="academy-grid min-h-[75vh]">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--brand)]">
            {t.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-.04em] sm:text-5xl">
            {joined ? (activity?.title[language] ?? t.activity) : t.title}
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--text-secondary)]">
            {joined ? (activity?.summary[language] ?? t.intro) : t.intro}
          </p>
          {!joined ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void join();
              }}
              className="mt-8 grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6"
            >
              <label className="text-sm font-semibold">
                {t.code}
                <input
                  required
                  pattern="[A-Z2-9\\-]{6,12}"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                  className="numeric mt-2 min-h-12 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 text-lg tracking-[.15em]"
                />
              </label>
              <label className="text-sm font-semibold">
                {t.alias}
                <input
                  required
                  minLength={2}
                  maxLength={32}
                  value={alias}
                  onChange={(event) => setAlias(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 font-normal"
                />
              </label>
              <Button type="submit" size="lg" loading={status === "loading"}>
                <Users size={18} />
                {t.join}
              </Button>
              {error ? (
                <p role="alert" className="text-sm text-[var(--negative)]">
                  {error}
                </p>
              ) : null}
              <p className="flex items-start gap-2 text-xs leading-5 text-[var(--text-tertiary)]">
                <ShieldCheck className="mt-0.5 shrink-0" size={15} />
                {t.intro}
              </p>
            </form>
          ) : status === "done" ? (
            <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--positive)] bg-[var(--positive-soft)] p-8 text-center">
              <CheckCircle2
                className="mx-auto text-[var(--positive)]"
                size={40}
              />
              <h2 className="mt-4 text-2xl font-semibold">{t.done}</h2>
              <p className="mt-3 text-[var(--text-secondary)]">{t.doneBody}</p>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6"
            >
              {scam ? (
                <>
                  <blockquote className="rounded bg-[var(--surface-2)] p-4 leading-7">
                    {scam.message[language]}
                  </blockquote>
                  <fieldset className="mt-5">
                    <legend className="font-semibold">Signals</legend>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {scam.signals.map((signal) => (
                        <label
                          key={signal.id}
                          className="rounded border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"
                        >
                          <input
                            type="checkbox"
                            className="mr-2"
                            checked={signals.includes(signal.id)}
                            onChange={() =>
                              setSignals((items) =>
                                items.includes(signal.id)
                                  ? items.filter((id) => id !== signal.id)
                                  : [...items, signal.id],
                              )
                            }
                          />
                          {signal.text[language]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </>
              ) : life ? (
                <ClassOptions
                  options={life.options.map((item) => ({
                    id: item.id,
                    label: item.title[language],
                  }))}
                  selected={selected}
                  setSelected={setSelected}
                />
              ) : decision ? (
                <>
                  <p className="rounded bg-[var(--surface-2)] p-4 leading-7">
                    {decision.context[language]}
                  </p>
                  <ClassOptions
                    options={decision.options.map((item) => ({
                      id: item.id,
                      label: item.label[language],
                    }))}
                    selected={selected}
                    setSelected={setSelected}
                  />
                </>
              ) : null}
              <label className="mt-5 block text-sm font-semibold">
                {t.reasoning}
                <textarea
                  required
                  minLength={10}
                  rows={4}
                  value={reasoning}
                  onChange={(event) => setReasoning(event.target.value)}
                  placeholder={t.hint}
                  className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 font-normal"
                />
              </label>
              <Button
                type="submit"
                className="mt-5"
                loading={status === "loading"}
                disabled={!scam && !selected}
              >
                {t.submit}
              </Button>
              {error ? (
                <p role="alert" className="mt-3 text-sm text-[var(--negative)]">
                  {error}
                </p>
              ) : null}
            </form>
          )}
        </div>
      </section>
    </MarketingPage>
  );
}
function ClassOptions({
  options,
  selected,
  setSelected,
}: {
  options: Array<{ id: string; label: string }>;
  selected: string;
  setSelected: (id: string) => void;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="font-semibold">Options</legend>
      <div className="mt-3 grid gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={`rounded border p-3 ${selected === option.id ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-2)]"}`}
          >
            <input
              type="radio"
              name="class-option"
              required
              checked={selected === option.id}
              onChange={() => setSelected(option.id)}
              className="mr-2"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
