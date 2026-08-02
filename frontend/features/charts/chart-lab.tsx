"use client";

import { useState } from "react";
import { CheckCircle2, Eye, RotateCcw } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/features/preferences";
import type { LocalizedText } from "@/lib/academy-types";
import { DEMO_CANDLES } from "@/lib/demo-academy";
import { ChartLoader } from "./chart-loader";

type Exercise = {
  id: string;
  name: LocalizedText;
  prompt: LocalizedText;
  options: Array<{ id: string; label: LocalizedText }>;
  correct: string;
  feedback: LocalizedText;
  support?: number;
  resistance?: number;
};

const text = (de: string, sl: string, en: string): LocalizedText => ({
  de,
  sl,
  en,
});
const choices = (...items: Array<[string, string, string, string]>) =>
  items.map(([id, de, sl, en]) => ({ id, label: text(de, sl, en) }));

export const CHART_EXERCISES: Exercise[] = [
  {
    id: "trend",
    name: text("Trend erkennen", "Prepoznaj trend", "Identify trend"),
    prompt: text(
      "Welche Marktstruktur ist sichtbar?",
      "Katera tržna struktura je vidna?",
      "Which market structure is visible?",
    ),
    options: choices(
      ["up", "Aufwärtstrend", "Rastoči trend", "Uptrend"],
      ["down", "Abwärtstrend", "Padajoči trend", "Downtrend"],
      ["range", "Seitwärtsphase", "Razpon", "Range"],
    ),
    correct: "up",
    feedback: text(
      "Höhere Hochs und höhere Tiefs bilden einen Aufwärtstrend. Das ist Kontext, keine Garantie.",
      "Višji vrhovi in dna tvorijo rastoči trend. To je kontekst, ne jamstvo.",
      "Higher highs and higher lows form an uptrend. That is context, not a guarantee.",
    ),
  },
  {
    id: "support",
    name: text("Support markieren", "Označi podporo", "Mark support"),
    prompt: text(
      "Welche Zone wurde mehrfach als Unterstützung respektiert?",
      "Katero območje je večkrat delovalo kot podpora?",
      "Which zone was repeatedly respected as support?",
    ),
    options: choices(
      ["101", "Um 101", "Okoli 101", "Around 101"],
      ["106", "Um 106", "Okoli 106", "Around 106"],
      ["111", "Um 111", "Okoli 111", "Around 111"],
    ),
    correct: "101",
    feedback: text(
      "Mehrere Reaktionen um 101 machen die Zone relevant; sie ist keine feste Linie.",
      "Več odzivov okoli 101 naredi območje pomembno; ni trdna črta.",
      "Repeated reactions around 101 make the zone relevant; it is not an exact line.",
    ),
    support: 101,
  },
  {
    id: "resistance",
    name: text("Resistance markieren", "Označi odpor", "Mark resistance"),
    prompt: text(
      "Wo liegt der nächste sichtbare Widerstand?",
      "Kje je naslednji vidni odpor?",
      "Where is the next visible resistance?",
    ),
    options: choices(
      ["103", "Um 103", "Okoli 103", "Around 103"],
      ["108", "Um 108", "Okoli 108", "Around 108"],
      ["114", "Um 114", "Okoli 114", "Around 114"],
    ),
    correct: "108",
    feedback: text(
      "Die Hochs bündeln sich um 108. Ein Bruch braucht dennoch Bestätigung.",
      "Vrhovi se zbirajo okoli 108. Preboj še vedno potrebuje potrditev.",
      "Highs cluster around 108. A break still needs confirmation.",
    ),
    resistance: 108,
  },
  {
    id: "stop",
    name: text("Stop wählen", "Izberi stop", "Choose a stop"),
    prompt: text(
      "Welcher Long-Stop liegt hinter der sichtbaren Invalidierung?",
      "Kateri dolgi stop leži za vidno razveljavitvijo?",
      "Which long stop sits beyond visible invalidation?",
    ),
    options: choices(
      ["100.4", "100,40", "100,40", "100.40"],
      ["102.8", "102,80", "102,80", "102.80"],
      ["106.2", "106,20", "106,20", "106.20"],
    ),
    correct: "100.4",
    feedback: text(
      "Ein Stop unter der Unterstützungszone definiert die Invalidierung; die Größe muss dazu passen.",
      "Stop pod območjem podpore določi razveljavitev; količina se mora prilagoditi.",
      "A stop below support defines invalidation; position size must adapt.",
    ),
    support: 101,
  },
  {
    id: "size",
    name: text("Positionsgröße", "Velikost pozicije", "Position size"),
    prompt: text(
      "50 € Risikobudget und 1 € Risiko je Stück: welche Größe?",
      "50 € tveganja in 1 € tveganja na enoto: kolikšna količina?",
      "€50 risk budget and €1 risk per unit: what size?",
    ),
    options: choices(
      ["25", "25 Stück", "25 enot", "25 units"],
      ["50", "50 Stück", "50 enot", "50 units"],
      ["100", "100 Stück", "100 enot", "100 units"],
    ),
    correct: "50",
    feedback: text(
      "Positionsgröße = Risikobudget / Risiko je Stück = 50 / 1 = 50.",
      "Velikost = proračun tveganja / tveganje na enoto = 50 / 1 = 50.",
      "Position size = risk budget / risk per unit = 50 / 1 = 50.",
    ),
  },
  {
    id: "failure",
    name: text("Fehlausbruch", "Lažni preboj", "Failed breakout"),
    prompt: text(
      "Was bestätigt am ehesten einen Fehlausbruch?",
      "Kaj najjasneje potrdi neuspeli preboj?",
      "What most clearly confirms a failed breakout?",
    ),
    options: choices(
      [
        "close-back",
        "Schluss zurück in der Range",
        "Zaključek nazaj v razponu",
        "Close back inside the range",
      ],
      [
        "wick",
        "Nur ein Docht darüber",
        "Le stenj nad območjem",
        "Only a wick above",
      ],
      [
        "volume",
        "Hohes Volumen allein",
        "Samo velik obseg",
        "High volume alone",
      ],
    ),
    correct: "close-back",
    feedback: text(
      "Die Rückkehr in die frühere Range zeigt, dass der Ausbruch nicht gehalten wurde.",
      "Vrnitev v prejšnji razpon pokaže, da preboj ni obstal.",
      "Returning inside the prior range shows the break did not hold.",
    ),
    resistance: 108,
  },
  {
    id: "timeframes",
    name: text("Zwei Zeitebenen", "Dva časovna okvira", "Compare timeframes"),
    prompt: text(
      "Welche Aussage nutzt zwei Zeitebenen sinnvoll?",
      "Katera trditev smiselno uporablja dva časovna okvira?",
      "Which statement uses two timeframes sensibly?",
    ),
    options: choices(
      [
        "context",
        "Höherer Trend, niedrigerer Einstiegskontext",
        "Višji trend, nižji kontekst vstopa",
        "Higher-timeframe trend, lower-timeframe entry context",
      ],
      [
        "guarantee",
        "Beide grün garantiert Gewinn",
        "Oba zelena jamčita dobiček",
        "Both green guarantees profit",
      ],
      [
        "ignore",
        "Nur die kleinste Kerze zählt",
        "Šteje le najmanjša sveča",
        "Only the smallest candle matters",
      ],
    ),
    correct: "context",
    feedback: text(
      "Die höhere Ebene liefert Kontext, die niedrigere Präzision—keine davon garantiert das Ergebnis.",
      "Višji okvir poda kontekst, nižji natančnost; noben ne jamči izida.",
      "The higher timeframe supplies context and the lower one precision; neither guarantees outcome.",
    ),
  },
  {
    id: "leverage",
    name: text("Hebelrisiko", "Tveganje vzvoda", "Leverage risk"),
    prompt: text(
      "2.000 € Eigenkapital, 10.000 € Exposure: welcher Hebel?",
      "2.000 € kapitala in 10.000 € izpostavljenosti: kolikšen vzvod?",
      "€2,000 equity and €10,000 exposure: what leverage?",
    ),
    options: choices(
      ["2", "2×", "2×", "2×"],
      ["5", "5×", "5×", "5×"],
      ["10", "10×", "10×", "10×"],
    ),
    correct: "5",
    feedback: text(
      "10.000 / 2.000 = 5×. Eine 6-%-Gegenbewegung entspricht vor Kosten 30 % Eigenkapital.",
      "10.000 / 2.000 = 5×. 6-% nasprotni premik pomeni 30 % kapitala pred stroški.",
      "10,000 / 2,000 = 5×. A 6% adverse move equals 30% of equity before costs.",
    ),
  },
  {
    id: "reward-risk",
    name: text("Chance-Risiko", "Razmerje donos-tveganje", "Reward to risk"),
    prompt: text(
      "Einstieg 104, Stop 102, Ziel 108: welches Verhältnis?",
      "Vstop 104, stop 102, cilj 108: kakšno razmerje?",
      "Entry 104, stop 102, target 108: what ratio?",
    ),
    options: choices(
      ["1", "1:1", "1:1", "1:1"],
      ["2", "2:1", "2:1", "2:1"],
      ["4", "4:1", "4:1", "4:1"],
    ),
    correct: "2",
    feedback: text(
      "Risiko 2 und potenzielle Chance 4 ergeben 2:1 vor Kosten.",
      "Tveganje 2 in možni donos 4 pomenita 2:1 pred stroški.",
      "Risk is 2 and potential reward 4, so 2:1 before costs.",
    ),
    support: 102,
    resistance: 108,
  },
  {
    id: "liquidity",
    name: text("Liquidität", "Likvidnost", "Liquidity"),
    prompt: text(
      "Was warnt am stärksten vor schlechter Ausführung?",
      "Kaj najmočneje opozarja na slabo izvršitev?",
      "What most strongly warns of poor execution?",
    ),
    options: choices(
      [
        "thin",
        "Niedriges Volumen und Preissprünge",
        "Majhen obseg in cenovni skoki",
        "Low volume and price jumps",
      ],
      [
        "color",
        "Viele grüne Kerzen",
        "Veliko zelenih sveč",
        "Many green candles",
      ],
      [
        "ma",
        "Preis über Durchschnitt",
        "Cena nad povprečjem",
        "Price above an average",
      ],
    ),
    correct: "thin",
    feedback: text(
      "Dünne Aktivität und Sprünge erhöhen Spread-, Slippage- und Nichtausführungsrisiko.",
      "Redka dejavnost in skoki povečajo tveganje razmika, zdrsa in neizvršitve.",
      "Thin activity and jumps increase spread, slippage, and non-execution risk.",
    ),
  },
  {
    id: "vwap",
    name: text("VWAP-Kontext", "Kontekst VWAP", "VWAP context"),
    prompt: text(
      "Was bedeutet Preis über VWAP am ehesten?",
      "Kaj najverjetneje pomeni cena nad VWAP?",
      "What does price above VWAP most reasonably mean?",
    ),
    options: choices(
      [
        "context",
        "Über volumen-gewichtetem Durchschnitt",
        "Nad volumensko tehtanim povprečjem",
        "Above the volume-weighted average",
      ],
      [
        "buy",
        "Sicheres Kaufsignal",
        "Zanesljiv nakupni signal",
        "Guaranteed buy signal",
      ],
      [
        "profit",
        "Profit ist wahrscheinlich",
        "Dobiček je verjeten",
        "Profit is likely",
      ],
    ),
    correct: "context",
    feedback: text(
      "VWAP beschreibt relativen Ausführungskontext; er sagt den nächsten Preis nicht sicher voraus.",
      "VWAP opisuje relativni kontekst izvršitve; ne napove zanesljivo naslednje cene.",
      "VWAP describes relative execution context; it does not guarantee the next price.",
    ),
  },
  {
    id: "atr",
    name: text("ATR-Distanz", "Razdalja ATR", "ATR distance"),
    prompt: text(
      "ATR 1,5 und Stopdistanz 0,5: wie breit relativ zur ATR?",
      "ATR 1,5 in razdalja stopa 0,5: kako široko glede na ATR?",
      "ATR 1.5 and stop distance 0.5: how wide relative to ATR?",
    ),
    options: choices(
      ["0.33", "0,33 ATR", "0,33 ATR", "0.33 ATR"],
      ["1.5", "1,5 ATR", "1,5 ATR", "1.5 ATR"],
      ["3", "3 ATR", "3 ATR", "3 ATR"],
    ),
    correct: "0.33",
    feedback: text(
      "0,5 / 1,5 = 0,33 ATR. Das beschreibt Distanz, nicht die richtige Stopwahl.",
      "0,5 / 1,5 = 0,33 ATR. To opisuje razdaljo, ne pravilne izbire stopa.",
      "0.5 / 1.5 = 0.33 ATR. That describes distance, not whether the stop is correct.",
    ),
  },
];

const interfaceCopy = {
  de: { reset: "Zurücksetzen", exercise: "Übung", all: "Alle Übungen" },
  sl: { reset: "Ponastavi", exercise: "Vaja", all: "Vse vaje" },
  en: { reset: "Reset", exercise: "Exercise", all: "All exercises" },
};

export function ChartLaboratory() {
  const { dictionary, language } = usePreferences();
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(25);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const active = CHART_EXERCISES[activeIndex];
  const answer = answers[active.id];
  const isChecked = Boolean(checked[active.id]);
  const correct = answer === active.correct;
  const ui = interfaceCopy[language];
  const selectExercise = (index: number) => {
    setActiveIndex(index);
    setVisible(25);
  };
  return (
    <>
      <PageHeading
        eyebrow={`${dictionary.nav.practice} · ${String(activeIndex + 1).padStart(2, "0")} / ${CHART_EXERCISES.length}`}
        title={dictionary.practice.title}
        description={dictionary.practice.intro}
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2" aria-label={ui.all}>
        {CHART_EXERCISES.map((exercise, index) => (
          <button
            type="button"
            key={exercise.id}
            onClick={() => selectExercise(index)}
            aria-current={index === activeIndex ? "step" : undefined}
            className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-semibold ${index === activeIndex ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : checked[exercise.id] ? "border-[var(--positive)] text-[var(--positive)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)]"}`}
          >
            {index + 1}. {exercise.name[language]}
          </button>
        ))}
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <div className="mb-3 rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3 text-xs text-[var(--warning)]">
            {dictionary.practice.simulated}
          </div>
          <ChartLoader
            candles={DEMO_CANDLES.slice(0, visible)}
            support={isChecked ? active.support : undefined}
            resistance={isChecked ? active.resistance : undefined}
            label={dictionary.practice.simulated}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setVisible((value) => Math.min(DEMO_CANDLES.length, value + 1))
              }
              disabled={visible === DEMO_CANDLES.length}
            >
              <Eye aria-hidden="true" size={16} />
              {dictionary.practice.replay}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setVisible(25);
                setAnswers((value) => ({ ...value, [active.id]: "" }));
                setChecked((value) => ({ ...value, [active.id]: false }));
              }}
            >
              <RotateCcw aria-hidden="true" size={16} />
              {ui.reset}
            </Button>
            <span className="numeric inline-flex min-h-10 items-center rounded-full border border-[var(--border-subtle)] px-3 text-xs">
              {visible} / {DEMO_CANDLES.length}
            </span>
          </div>
        </section>
        <aside className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
          <p className="text-xs font-semibold text-[var(--electric)]">
            {ui.exercise} {activeIndex + 1}: {active.name[language]}
          </p>
          <h2 className="mt-3 text-xl font-semibold">
            {active.prompt[language]}
          </h2>
          <fieldset className="mt-5 space-y-2">
            <legend className="sr-only">{active.prompt[language]}</legend>
            {active.options.map((option) => (
              <label key={option.id} className="block cursor-pointer">
                <input
                  type="radio"
                  name={`chart-${active.id}`}
                  checked={answer === option.id}
                  onChange={() => {
                    setAnswers((value) => ({
                      ...value,
                      [active.id]: option.id,
                    }));
                    setChecked((value) => ({ ...value, [active.id]: false }));
                  }}
                  className="peer sr-only"
                />
                <span className="flex min-h-12 items-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 peer-checked:border-[var(--electric)] peer-checked:bg-[var(--electric-soft)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--electric)]">
                  {option.label[language]}
                </span>
              </label>
            ))}
          </fieldset>
          <Button
            className="mt-5 w-full"
            disabled={!answer}
            onClick={() =>
              setChecked((value) => ({ ...value, [active.id]: true }))
            }
          >
            {dictionary.practice.check}
          </Button>
          {isChecked ? (
            <div
              role="status"
              className={`mt-4 rounded-[var(--radius-sm)] border p-4 text-sm ${correct ? "border-[var(--positive)] bg-[var(--positive-soft)]" : "border-[var(--warning)] bg-[var(--warning-soft)]"}`}
            >
              <p className="flex items-center gap-2 font-semibold">
                {correct ? <CheckCircle2 aria-hidden="true" size={17} /> : null}
                {correct ? dictionary.quiz.correct : dictionary.quiz.incorrect}
              </p>
              <p className="mt-2 leading-6 text-[var(--text-secondary)]">
                {active.feedback[language]}
              </p>
            </div>
          ) : null}
          <div className="mt-6 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
            <Button
              variant="ghost"
              disabled={activeIndex === 0}
              onClick={() => selectExercise(activeIndex - 1)}
            >
              {dictionary.common.previous}
            </Button>
            <Button
              variant="secondary"
              disabled={activeIndex === CHART_EXERCISES.length - 1}
              onClick={() => selectExercise(activeIndex + 1)}
            >
              {dictionary.common.next}
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}
