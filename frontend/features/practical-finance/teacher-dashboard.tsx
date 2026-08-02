"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ClipboardCopy,
  Download,
  Play,
  Square,
  Users,
} from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button, Surface } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-provider";
import { usePreferences } from "@/features/preferences";
import { academyApi } from "@/lib/api-client";
import { practicalContent } from "./content";
import {
  closeDemoClassroom,
  createDemoClassroom,
  usePracticalDemoState,
} from "./practical-store";
import type { DemoClassroom } from "./types";

const copy = {
  de: {
    eyebrow: "Teacher Mode · Live",
    title: "Lehrer-Dashboard",
    intro:
      "Sitzungen vorbereiten, anonymen Fortschritt beobachten und Prozesssignale statt Gewinnerlisten besprechen.",
    activity: "Aktivität",
    duration: "Dauer",
    create: "Klassenzimmer starten",
    code: "Klassencode",
    copy: "Code kopieren",
    join: "Beitrittsseite",
    participants: "Teilnehmende",
    responses: "Antworten",
    score: "Prozessscore",
    distribution: "Entscheidungsverteilung",
    review: "Zu wiederholen",
    report: "CSV exportieren",
    close: "Sitzung schließen",
    empty:
      "Noch keine Sitzung. Wähle eine Aktivität und starte einen lokalen oder kontobasierten Pilot.",
    material: "Lehrmaterial",
    local: "Lokale Demo",
    account: "Kontobasiert",
    error: "Das Klassenzimmer konnte nicht aktualisiert werden.",
  },
  sl: {
    eyebrow: "Način za učitelje · v živo",
    title: "Nadzorna plošča učitelja",
    intro:
      "Pripravi srečanja, spremljaj anonimni napredek in obravnavaj procesne signale namesto lestvic zmagovalcev.",
    activity: "Dejavnost",
    duration: "Trajanje",
    create: "Začni razred",
    code: "Koda razreda",
    copy: "Kopiraj kodo",
    join: "Stran za pridružitev",
    participants: "Udeleženci",
    responses: "Odgovori",
    score: "Ocena procesa",
    distribution: "Porazdelitev odločitev",
    review: "Za ponovitev",
    report: "Izvozi CSV",
    close: "Zapri srečanje",
    empty:
      "Ni še srečanja. Izberi dejavnost in začni lokalni ali računovodski pilot.",
    material: "Gradivo za učitelja",
    local: "Lokalni demo",
    account: "Učni račun",
    error: "Razreda ni bilo mogoče posodobiti.",
  },
  en: {
    eyebrow: "Teacher Mode · Live",
    title: "Teacher dashboard",
    intro:
      "Prepare sessions, monitor anonymous progress, and discuss process signals instead of winner leaderboards.",
    activity: "Activity",
    duration: "Duration",
    create: "Start classroom",
    code: "Class code",
    copy: "Copy code",
    join: "Join page",
    participants: "Participants",
    responses: "Responses",
    score: "Process score",
    distribution: "Decision distribution",
    review: "Needs review",
    report: "Export CSV",
    close: "Close session",
    empty:
      "No session yet. Choose an activity and start a local or account-backed pilot.",
    material: "Teacher material",
    local: "Local demo",
    account: "Account-backed",
    error: "The classroom could not be updated.",
  },
} as const;
type RemoteSession = {
  id: string;
  activity_type: string;
  activity_id: string;
  content_version: string;
  duration_minutes: 45 | 90;
  status: "active" | "closed";
  created_at: string;
};
type RemoteCreated = RemoteSession & { classroom_code: string };
type RemoteDashboard = {
  active_participants: number;
  completed_participants: number;
  response_count: number;
  class_process_score: number;
  decision_distribution: Record<string, number>;
  concepts_requiring_review: string[];
};

export function TeacherDashboard() {
  const { language } = usePreferences();
  const { user } = useAuth();
  const demo = usePracticalDemoState();
  const t = copy[language];
  const [activityId, setActivityId] = useState(
    practicalContent.classrooms[0].id,
  );
  const [duration, setDuration] = useState<45 | 90>(45);
  const [remoteSessions, setRemoteSessions] = useState<RemoteSession[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [latestCode, setLatestCode] = useState("");
  const [dashboard, setDashboard] = useState<RemoteDashboard | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    void academyApi<RemoteSession[]>("/teacher/classrooms")
      .then((items) => {
        setRemoteSessions(items);
        if (items[0]) setSelectedId((current) => current || items[0].id);
      })
      .catch(() => setError(t.error));
  }, [t.error, user]);
  useEffect(() => {
    if (!user || !selectedId) return;
    let active = true;
    const load = () =>
      academyApi<RemoteDashboard>(`/teacher/classrooms/${selectedId}/dashboard`)
        .then((value) => {
          if (active) setDashboard(value);
        })
        .catch(() => {
          if (active) setError(t.error);
        });
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedId, t.error, user]);
  const sessions: DemoClassroom[] = user
    ? remoteSessions.map((item) => ({
        id: item.id,
        code: item.id === selectedId ? latestCode : "",
        activityId: item.activity_id,
        activityType: item.activity_type,
        contentVersion: item.content_version,
        durationMinutes: item.duration_minutes,
        status: item.status,
        participantCount:
          item.id === selectedId
            ? (dashboard?.active_participants ?? 0) +
              (dashboard?.completed_participants ?? 0)
            : 0,
        responses: [],
        createdAt: item.created_at,
      }))
    : demo.classrooms;
  const selected =
    sessions.find((item) => item.id === selectedId) ?? sessions[0];
  const localDashboard = useMemo(() => {
    if (!selected) return null;
    const distribution: Record<string, number> = {};
    const misconceptions: Record<string, number> = {};
    const completedParticipants = new Set(
      selected.responses.map((response) => response.participantId),
    ).size;
    for (const response of selected.responses) {
      distribution[response.selectedOptionId] =
        (distribution[response.selectedOptionId] ?? 0) + 1;
      for (const value of response.misconceptions)
        misconceptions[value] = (misconceptions[value] ?? 0) + 1;
    }
    return {
      active_participants: Math.max(
        0,
        selected.participantCount - completedParticipants,
      ),
      completed_participants: completedParticipants,
      response_count: selected.responses.length,
      class_process_score: selected.responses.length
        ? Math.round(
            selected.responses.reduce(
              (sum, item) => sum + item.processScore,
              0,
            ) / selected.responses.length,
          )
        : 0,
      decision_distribution: distribution,
      concepts_requiring_review: Object.entries(misconceptions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name),
    };
  }, [selected]);
  const stats = user ? dashboard : localDashboard;
  async function create() {
    const activity = practicalContent.classrooms.find(
      (item) => item.id === activityId,
    )!;
    setSaving(true);
    setError("");
    try {
      if (user) {
        const created = await academyApi<RemoteCreated>("/teacher/classrooms", {
          method: "POST",
          body: {
            activity_type:
              activity.kind === "life-simulator"
                ? "life_simulator"
                : activity.kind === "scam-detector"
                  ? "scam_detector"
                  : activity.kind === "decision-lab"
                    ? "decision_lab"
                    : activity.id.includes("credit")
                      ? "credit_comparison"
                      : activity.id.includes("inflation")
                        ? "inflation_interest"
                        : "risk_case",
            activity_id: activity.id,
            content_version: activity.version,
            duration_minutes: duration,
            settings: { show_aggregate_only: true },
          },
        });
        setRemoteSessions((items) => [created, ...items]);
        setSelectedId(created.id);
        setLatestCode(created.classroom_code);
      } else {
        const created = createDemoClassroom({
          activityId: activity.id,
          activityType: activity.kind,
          contentVersion: activity.version,
          durationMinutes: duration,
          status: "active",
        });
        setSelectedId(created.id);
        setLatestCode(created.code);
      }
    } catch {
      setError(t.error);
    } finally {
      setSaving(false);
    }
  }
  function exportCsv() {
    if (!selected || !stats) return;
    const rows = [
      ["metric", "value"],
      [
        "participants",
        String(stats.active_participants + stats.completed_participants),
      ],
      ["responses", String(stats.response_count)],
      ["process_score", String(stats.class_process_score)],
      ...Object.entries(stats.decision_distribution).map(([key, value]) => [
        `decision:${key}`,
        String(value),
      ]),
    ];
    const blob = new Blob(
      [
        rows
          .map((row) =>
            row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
          )
          .join("\n"),
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `classroom-${selected.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function close() {
    if (!selected) return;
    try {
      if (user) {
        const updated = await academyApi<RemoteSession>(
          `/teacher/classrooms/${selected.id}/close`,
          { method: "POST" },
        );
        setRemoteSessions((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
      } else closeDemoClassroom(selected.id);
    } catch {
      setError(t.error);
    }
  }
  const code = latestCode || (selected?.code ?? "");
  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.intro}
        actions={
          <Link
            href="/teachers"
            className="text-sm font-semibold text-[var(--brand)]"
          >
            {t.material}
          </Link>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Surface padding="lg">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand)]">
              {user ? t.account : t.local}
            </p>
            <label className="mt-4 block text-sm font-semibold">
              {t.activity}
              <select
                value={activityId}
                onChange={(event) => setActivityId(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 font-normal"
              >
                {practicalContent.classrooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title[language]}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">{t.duration}</legend>
              <div className="mt-2 flex gap-2">
                {([45, 90] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDuration(value)}
                    className={`min-h-10 flex-1 rounded-[var(--radius-sm)] border ${duration === value ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border-subtle)]"}`}
                  >
                    {value} min
                  </button>
                ))}
              </div>
            </fieldset>
            <Button
              className="mt-5 w-full"
              loading={saving}
              onClick={() => void create()}
            >
              <Play size={16} aria-hidden="true" />
              {t.create}
            </Button>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-[var(--negative)]">
                {error}
              </p>
            ) : null}
          </Surface>
          {sessions.length ? (
            <Surface>
              <h2 className="font-semibold">Sessions</h2>
              <div className="mt-3 space-y-2">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => {
                      setSelectedId(session.id);
                      setDashboard(null);
                    }}
                    className={`w-full rounded-[var(--radius-sm)] p-3 text-left text-sm ${selected?.id === session.id ? "bg-[var(--brand-soft)]" : "bg-[var(--surface-2)]"}`}
                  >
                    <span className="font-semibold">
                      {practicalContent.classrooms.find(
                        (item) => item.id === session.activityId,
                      )?.title[language] ?? session.activityId}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--text-tertiary)]">
                      {session.status} · {session.durationMinutes} min
                    </span>
                  </button>
                ))}
              </div>
            </Surface>
          ) : null}
        </aside>
        <section>
          {!selected ? (
            <Surface padding="lg">
              <Users className="text-[var(--brand)]" />
              <p className="mt-4 text-[var(--text-secondary)]">{t.empty}</p>
            </Surface>
          ) : (
            <>
              <Surface padding="lg" className="academy-grid">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.15em] text-[var(--positive)]">
                      {selected.status}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      {
                        practicalContent.classrooms.find(
                          (item) => item.id === selected.activityId,
                        )?.title[language]
                      }
                    </h2>
                  </div>
                  {code ? (
                    <div className="rounded-[var(--radius-md)] border border-[var(--brand)] bg-[var(--surface-1)] p-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-[.15em] text-[var(--text-tertiary)]">
                        {t.code}
                      </p>
                      <p className="numeric mt-1 text-3xl font-semibold tracking-[.18em]">
                        {code}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void navigator.clipboard.writeText(code)
                          }
                        >
                          <ClipboardCopy size={14} />
                          {t.copy}
                        </Button>
                        <Link
                          className="inline-flex min-h-10 items-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 text-xs font-semibold"
                          href={`/class/${code}`}
                        >
                          {t.join}
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Surface>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Metric
                  icon={Users}
                  label={t.participants}
                  value={
                    stats
                      ? stats.active_participants + stats.completed_participants
                      : 0
                  }
                />
                <Metric
                  icon={BarChart3}
                  label={t.responses}
                  value={stats?.response_count ?? 0}
                />
                <Metric
                  icon={BarChart3}
                  label={t.score}
                  value={`${stats?.class_process_score ?? 0}%`}
                />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Surface>
                  <h3 className="font-semibold">{t.distribution}</h3>
                  {stats && Object.keys(stats.decision_distribution).length ? (
                    <div className="mt-4 space-y-3">
                      {Object.entries(stats.decision_distribution).map(
                        ([key, value]) => (
                          <div key={key}>
                            <div className="flex justify-between text-sm">
                              <span>{key}</span>
                              <span className="numeric">{value}</span>
                            </div>
                            <div className="mt-1 h-2 rounded bg-[var(--surface-3)]">
                              <div
                                className="h-full rounded bg-[var(--brand)]"
                                style={{
                                  width: `${Math.min(100, (value / Math.max(1, stats.response_count)) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--text-tertiary)]">
                      Waiting for anonymous responses…
                    </p>
                  )}
                </Surface>
                <Surface>
                  <h3 className="font-semibold">{t.review}</h3>
                  <ul className="mt-4 space-y-2 text-sm">
                    {stats?.concepts_requiring_review.length ? (
                      stats.concepts_requiring_review.map((item) => (
                        <li
                          key={item}
                          className="rounded bg-[var(--warning-soft)] p-3"
                        >
                          {item}
                        </li>
                      ))
                    ) : (
                      <li className="text-[var(--text-tertiary)]">
                        No aggregate misconception yet.
                      </li>
                    )}
                  </ul>
                </Surface>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={exportCsv}>
                  <Download size={16} />
                  {t.report}
                </Button>
                {selected.status === "active" ? (
                  <Button variant="danger" onClick={() => void close()}>
                    <Square size={15} />
                    {t.close}
                  </Button>
                ) : null}
                <Link
                  href={`/teachers/materials/${selected.activityId}`}
                  className="inline-flex min-h-10 items-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-4 text-sm font-semibold"
                >
                  {t.material}
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <Surface>
      <Icon size={18} className="text-[var(--brand)]" />
      <p className="mt-3 text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="numeric mt-1 text-2xl font-semibold">{value}</p>
    </Surface>
  );
}
