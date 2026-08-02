"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, UserRound } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { usePreferences } from "@/features/preferences";
import { academyApi } from "@/lib/api-client";

type ProfileRead = {
  display_name: string | null;
  locale: "de" | "sl" | "en";
  timezone: string;
  bio: string | null;
};
const copy = {
  de: {
    name: "Anzeigename",
    timezone: "Zeitzone",
    bio: "Über dein Lernziel",
    email: "Konto-E-Mail",
    saved: "Profil gespeichert.",
    demo: "Die Demo hat kein persönliches Konto. Du kannst trotzdem einen lokalen Lernplan erstellen.",
    account: "Konto erstellen",
    plan: "Lernplan bearbeiten",
  },
  sl: {
    name: "Prikazno ime",
    timezone: "Časovni pas",
    bio: "O tvojem učnem cilju",
    email: "E-pošta računa",
    saved: "Profil je shranjen.",
    demo: "Demo nima osebnega računa. Kljub temu lahko ustvariš lokalni učni načrt.",
    account: "Ustvari račun",
    plan: "Uredi učni načrt",
  },
  en: {
    name: "Display name",
    timezone: "Timezone",
    bio: "About your learning goal",
    email: "Account email",
    saved: "Profile saved.",
    demo: "The demo has no personal account. You can still create a local learning plan.",
    account: "Create account",
    plan: "Edit learning plan",
  },
};

export function ProfilePage() {
  const { dictionary, language } = usePreferences();
  const { user } = useAuth();
  const { mode, state } = useDemoWorkspace();
  const queryClient = useQueryClient();
  const strings = copy[language];
  const query = useQuery({
    queryKey: ["academy", "profile"],
    queryFn: async () => (await academyApi<ProfileRead>("/profile")) ?? null,
    enabled: mode === "authenticated",
    retry: 1,
  });
  const [nameOverride, setName] = useState<string | null>(null);
  const [timezoneOverride, setTimezone] = useState<string | null>(null);
  const [bioOverride, setBio] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const name = nameOverride ?? query.data?.display_name ?? "";
  const timezone =
    timezoneOverride ?? query.data?.timezone ?? "Europe/Ljubljana";
  const bio = bioOverride ?? query.data?.bio ?? "";
  const save = async () => {
    setStatus(null);
    try {
      await academyApi("/profile", {
        method: "PUT",
        body: {
          display_name: name || null,
          locale: language,
          timezone,
          bio: bio || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["academy", "profile"] });
      setStatus(strings.saved);
    } catch (reason) {
      setStatus(
        reason instanceof Error ? reason.message : dictionary.auth.error,
      );
    }
  };
  return (
    <>
      <PageHeading
        eyebrow={dictionary.brand.name}
        title={dictionary.secondary.profileTitle}
        description={dictionary.secondary.profileIntro}
      />
      {mode === "demo" ? (
        <section className="mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-7 text-center">
          <UserRound
            aria-hidden="true"
            className="mx-auto text-[var(--brand)]"
            size={34}
          />
          <p className="mt-4 leading-7 text-[var(--text-secondary)]">
            {strings.demo}
          </p>
          {state.onboarding ? (
            <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3 text-sm">
              {dictionary.onboarding.recommendation}:{" "}
              {state.onboarding.recommendation
                .replace("path-", "")
                .replaceAll("-", " ")}
            </p>
          ) : null}
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/onboarding"
              className="inline-flex min-h-10 items-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-4 font-semibold"
            >
              {strings.plan}
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-10 items-center rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 font-semibold text-[var(--brand-contrast)]"
            >
              {strings.account}
            </Link>
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-semibold">{strings.name}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3"
              />
            </label>
            <label>
              <span className="text-sm font-semibold">{strings.timezone}</span>
              <input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Mail aria-hidden="true" size={15} />
                {strings.email}
              </span>
              <input
                value={user?.email ?? ""}
                readOnly
                className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-3)] px-3"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold">{strings.bio}</span>
              <textarea
                rows={5}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"
              />
            </label>
          </div>
          {status ? (
            <p role="status" className="mt-4 text-sm text-[var(--brand)]">
              {status}
            </p>
          ) : null}
          <Button
            className="mt-5"
            onClick={() => void save()}
            disabled={query.isLoading}
          >
            {dictionary.common.save}
          </Button>
        </section>
      )}
    </>
  );
}
