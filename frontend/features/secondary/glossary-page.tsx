"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { ErrorState, Skeleton } from "@/components/ui";
import { usePreferences } from "@/features/preferences";
import type { LocalizedText } from "@/lib/academy-types";
import { academyApi } from "@/lib/api-client";
import { DEMO_GLOSSARY } from "@/lib/demo-academy";

type BackendTerm = { id: string; path_ids?: string[]; term: LocalizedText; definition: LocalizedText };
const copy = { de: { search: "Begriffe durchsuchen", all: "Alle Pfade", count: "Begriffe", error: "Das Glossar konnte nicht geladen werden." }, sl: { search: "Išči pojme", all: "Vse poti", count: "pojmov", error: "Slovarja ni bilo mogoče naložiti." }, en: { search: "Search terms", all: "All paths", count: "terms", error: "The glossary could not be loaded." } };

export function GlossaryPage() {
  const { dictionary, language } = usePreferences();
  const strings = copy[language];
  const [search, setSearch] = useState("");
  const [path, setPath] = useState("all");
  const query = useQuery({ queryKey: ["academy", "glossary"], queryFn: () => academyApi<BackendTerm[]>("/glossary"), retry: 1 });
  const terms: BackendTerm[] = query.data?.length ? query.data : DEMO_GLOSSARY.map((item) => ({ ...item, path_ids: ["path-finance-foundations"] }));
  const paths = useMemo(() => [...new Set(terms.flatMap((term) => term.path_ids ?? []))].sort(), [terms]);
  const filtered = useMemo(() => terms.filter((term) => (path === "all" || term.path_ids?.includes(path)) && `${term.term[language]} ${term.definition[language]}`.toLocaleLowerCase(language).includes(search.trim().toLocaleLowerCase(language))).sort((a, b) => a.term[language].localeCompare(b.term[language], language)), [language, path, search, terms]);
  return <><PageHeading eyebrow={`${terms.length} ${strings.count}`} title={dictionary.secondary.glossaryTitle} description={dictionary.secondary.glossaryIntro} />{query.isLoading && !query.data ? <Skeleton className="h-72" /> : query.isError && !terms.length ? <ErrorState title={dictionary.secondary.glossaryTitle} description={strings.error} /> : <><div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 sm:grid-cols-[minmax(0,1fr)_280px]"><label className="relative"><Search aria-hidden="true" size={17} className="absolute left-3 top-3 text-[var(--text-tertiary)]" /><span className="sr-only">{strings.search}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={strings.search} className="min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] pl-10 pr-3" /></label><label><span className="sr-only">{dictionary.learn.title}</span><select value={path} onChange={(event) => setPath(event.target.value)} className="min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3"><option value="all">{strings.all}</option>{paths.map((id) => <option key={id} value={id}>{id.replace("path-", "").replaceAll("-", " ")}</option>)}</select></label></div><p className="mt-4 text-xs text-[var(--text-tertiary)]">{filtered.length} {strings.count}</p><section className="mt-3 columns-1 gap-4 md:columns-2 xl:columns-3">{filtered.map((term) => <article key={term.id} className="mb-4 break-inside-avoid rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5"><h2 className="font-semibold text-[var(--brand)]">{term.term[language]}</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{term.definition[language]}</p><p className="mt-3 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">{term.path_ids?.map((id) => id.replace("path-", "").replaceAll("-", " ")).join(" · ")}</p></article>)}</section></>}</>;
}
