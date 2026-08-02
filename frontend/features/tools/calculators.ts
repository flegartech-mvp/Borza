import type { Language } from "@/i18n/dictionaries";

export const CALCULATOR_IDS = [
  "position-size",
  "reward-risk",
  "r-multiple",
  "expectancy",
  "profit-factor",
  "drawdown",
  "break-even-win-rate",
  "leverage-margin",
  "compound-interest",
  "present-value",
  "future-value",
  "npv",
  "irr",
  "bond-price",
  "yield",
  "capm",
  "wacc",
  "basic-dcf",
] as const;

export type CalculatorId = (typeof CALCULATOR_IDS)[number];
export type CalculatorCategory = "trading" | "finance";
export type LocalizedText = Record<Language, string>;
export type ResultKind = "currency" | "percent" | "ratio" | "units" | "number";

export type InputDefinition = {
  key: string;
  kind: "number" | "series";
  label: LocalizedText;
  help?: LocalizedText;
  defaultValue: string;
  min?: number;
  max?: number;
  exclusiveMin?: boolean;
  integer?: boolean;
  suffix?: LocalizedText;
};

export type OutputDefinition = {
  key: string;
  label: LocalizedText;
  kind: ResultKind;
  decimals: number;
};

export type CalculatorDefinition = {
  id: CalculatorId;
  category: CalculatorCategory;
  title: LocalizedText;
  summary: LocalizedText;
  formula: string;
  formulaExplanation: LocalizedText;
  workedExample: LocalizedText;
  interpretation: LocalizedText;
  commonMistake: LocalizedText;
  relatedLesson: { id: string; label: LocalizedText };
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
};

export type ValidationCode =
  | "required"
  | "invalidNumber"
  | "invalidSeries"
  | "minimum"
  | "exclusiveMinimum"
  | "maximum"
  | "integer"
  | "entryStopDifferent"
  | "oppositeSides"
  | "troughAbovePeak"
  | "cashFlowSigns"
  | "multipleIrr"
  | "irrBracket"
  | "irrConvergence"
  | "discountAboveGrowth"
  | "nonFiniteResult";

export type ValidationIssue = {
  code: ValidationCode;
  field?: string;
  limit?: number;
};

export type CalculationOutcome =
  | { ok: true; values: Record<string, number> }
  | { ok: false; issues: ValidationIssue[] };

type ParsedInputs = Record<string, number | number[]>;

const t = (de: string, sl: string, en: string): LocalizedText => ({ de, sl, en });

function numberInput(
  key: string,
  label: LocalizedText,
  defaultValue: string,
  options: Omit<InputDefinition, "key" | "kind" | "label" | "defaultValue"> = {},
): InputDefinition {
  return { key, kind: "number", label, defaultValue, ...options };
}

function seriesInput(
  key: string,
  label: LocalizedText,
  defaultValue: string,
  help: LocalizedText,
): InputDefinition {
  return { key, kind: "series", label, defaultValue, help };
}

function output(
  key: string,
  label: LocalizedText,
  kind: ResultKind,
  decimals = 2,
): OutputDefinition {
  return { key, label, kind, decimals };
}

const percent = t("%", "%", "%");
const euro = t("€", "€", "€");

export const CALCULATORS: readonly CalculatorDefinition[] = [
  {
    id: "position-size",
    category: "trading",
    title: t("Positionsgröße", "Velikost pozicije", "Position size"),
    summary: t(
      "Leite die Stückzahl aus einem festen Risikobudget und der Stop-Distanz ab.",
      "Iz proračuna tveganja in razdalje do stopa izpelji količino.",
      "Derive units from a fixed risk budget and stop distance.",
    ),
    formula: String.raw`Q = \frac{K \times r}{\lvert E-S \rvert}`,
    formulaExplanation: t(
      "Kontowert K mal Risikosatz r, geteilt durch das Risiko je Stück zwischen Einstieg E und Stop S.",
      "Vrednost računa K krat delež tveganja r, deljeno s tveganjem na enoto med vstopom E in stopom S.",
      "Account value K times risk fraction r, divided by per-unit risk between entry E and stop S.",
    ),
    workedExample: t(
      "10.000 € × 1 % ÷ |100 € − 99,50 €| = 200 Stück.",
      "10.000 € × 1 % ÷ |100 € − 99,50 €| = 200 enot.",
      "€10,000 × 1% ÷ |€100 − €99.50| = 200 units.",
    ),
    interpretation: t(
      "200 Stück begrenzen den geplanten Verlust vor Kosten auf 100 €; Slippage kann ihn erhöhen.",
      "200 enot omeji načrtovano izgubo pred stroški na 100 €; zdrs jo lahko poveča.",
      "Two hundred units cap planned loss before costs at €100; slippage can increase it.",
    ),
    commonMistake: t(
      "Die Positionsgröße zuerst wählen und den Stop danach passend verschieben.",
      "Najprej izbrati velikost in nato prilagoditi stop tej velikosti.",
      "Choosing size first and then moving the stop to make it fit.",
    ),
    relatedLesson: {
      id: "lesson-rm-position-sizing",
      label: t("Positionsgröße", "Velikost pozicije", "Position sizing"),
    },
    inputs: [
      numberInput("account", t("Kontowert", "Vrednost računa", "Account value"), "10000", { min: 0, exclusiveMin: true, suffix: euro }),
      numberInput("riskPercent", t("Risiko pro Trade", "Tveganje na posel", "Risk per trade"), "1", { min: 0, max: 100, exclusiveMin: true, suffix: percent }),
      numberInput("entry", t("Einstieg", "Vstop", "Entry"), "100", { min: 0, exclusiveMin: true, suffix: euro }),
      numberInput("stop", t("Stop", "Stop", "Stop"), "99.5", { min: 0, exclusiveMin: true, suffix: euro }),
    ],
    outputs: [output("units", t("Stückzahl", "Število enot", "Units"), "units")],
  },
  {
    id: "reward-risk",
    category: "trading",
    title: t("Chance-Risiko-Verhältnis", "Razmerje donos-tveganje", "Reward:risk ratio"),
    summary: t(
      "Vergleiche geplante Zielstrecke und Invalidierungsstrecke.",
      "Primerjaj načrtovano pot do cilja in razveljavitve.",
      "Compare the planned target distance with the invalidation distance.",
    ),
    formula: String.raw`CRV = \frac{\lvert T-E \rvert}{\lvert E-S \rvert}`,
    formulaExplanation: t(
      "Die Zielstrecke von Einstieg E zu Ziel T wird durch die Stop-Distanz geteilt.",
      "Razdaljo od vstopa E do cilja T deli razdalja do stopa.",
      "Target distance from entry E to target T divided by stop distance.",
    ),
    workedExample: t(
      "Einstieg 100 €, Stop 98 €, Ziel 106 €: 6 ÷ 2 = 3,00.",
      "Vstop 100 €, stop 98 €, cilj 106 €: 6 ÷ 2 = 3,00.",
      "Entry €100, stop €98, target €106: 6 ÷ 2 = 3.00.",
    ),
    interpretation: t(
      "3:1 beschreibt Größen, nicht Trefferwahrscheinlichkeit, Liquidität oder Kosten.",
      "3 : 1 opisuje velikosti, ne verjetnosti, likvidnosti ali stroškov.",
      "3:1 describes magnitudes, not probability, liquidity, or costs.",
    ),
    commonMistake: t(
      "Ein hohes Verhältnis als Garantie für ein gutes Setup behandeln.",
      "Visoko razmerje obravnavati kot jamstvo za dobro postavitev.",
      "Treating a high ratio as proof of a good setup.",
    ),
    relatedLesson: { id: "lesson-rm-r-multiple", label: t("R-Multiple", "Večkratnik R", "R multiples") },
    inputs: [
      numberInput("entry", t("Einstieg", "Vstop", "Entry"), "100", { min: 0, exclusiveMin: true, suffix: euro }),
      numberInput("stop", t("Stop", "Stop", "Stop"), "98", { min: 0, exclusiveMin: true, suffix: euro }),
      numberInput("target", t("Ziel", "Cilj", "Target"), "106", { min: 0, exclusiveMin: true, suffix: euro }),
    ],
    outputs: [output("ratio", t("Chance je 1 Risiko", "Donos na 1 tveganje", "Reward per 1 risk"), "ratio")],
  },
  {
    id: "r-multiple",
    category: "trading",
    title: t("R-Multiple", "Večkratnik R", "R multiple"),
    summary: t(
      "Drücke das realisierte Ergebnis in Einheiten des anfänglichen Risikos aus.",
      "Izrazi doseženi izid v enotah začetnega tveganja.",
      "Express the realised outcome in units of initial risk.",
    ),
    formula: String.raw`R = \frac{P_{exit}-P_{entry}}{\lvert P_{entry}-P_{stop}\rvert}`,
    formulaExplanation: t(
      "Für Long wird die Preisänderung durch die anfängliche Stop-Distanz geteilt; für Short wird das Vorzeichen gespiegelt.",
      "Za dolgo pozicijo se sprememba cene deli z začetno razdaljo do stopa; za kratko se predznak obrne.",
      "For a long, price change is divided by initial stop distance; for a short, the sign is reversed.",
    ),
    workedExample: t(
      "Long bei 100 €, Stop 98 €, Ausstieg 105 €: 5 ÷ 2 = +2,50 R.",
      "Dolga pozicija pri 100 €, stop 98 €, izstop 105 €: 5 ÷ 2 = +2,50 R.",
      "Long at €100, stop €98, exit €105: 5 ÷ 2 = +2.50R.",
    ),
    interpretation: t(
      "+2,5 R verdient das Zweieinhalbfache des ursprünglich geplanten Risikos vor Kosten.",
      "+2,5 R pomeni dva in pol kratnika prvotno načrtovanega tveganja pred stroški.",
      "+2.5R earns two and a half times the initially planned risk before costs.",
    ),
    commonMistake: t(
      "Den Stop nachträglich ändern und damit die R-Basis umschreiben.",
      "Naknadno spremeniti stop in s tem prepisati osnovo R.",
      "Changing the stop afterwards and rewriting the R baseline.",
    ),
    relatedLesson: { id: "lesson-rm-r-multiple", label: t("R-Multiple", "Večkratnik R", "R multiples") },
    inputs: [
      numberInput("entry", t("Einstieg", "Vstop", "Entry"), "100", { min: 0, exclusiveMin: true, suffix: euro }),
      numberInput("stop", t("Anfänglicher Stop", "Začetni stop", "Initial stop"), "98", { min: 0, exclusiveMin: true, suffix: euro }),
      numberInput("exit", t("Ausstieg", "Izstop", "Exit"), "105", { min: 0, exclusiveMin: true, suffix: euro }),
    ],
    outputs: [output("rMultiple", t("Ergebnis", "Izid", "Outcome"), "ratio")],
  },
  {
    id: "expectancy",
    category: "trading",
    title: t("Erwartungswert", "Pričakovana vrednost", "Expectancy"),
    summary: t(
      "Verbinde Trefferquote, Durchschnittsgewinn und Durchschnittsverlust.",
      "Poveži delež zmag, povprečno zmago in povprečno izgubo.",
      "Combine win rate, average win, and average loss.",
    ),
    formula: String.raw`E = p \times \bar{W} - (1-p) \times \bar{L}`,
    formulaExplanation: t(
      "Trefferwahrscheinlichkeit p mal Durchschnittsgewinn minus Verlustwahrscheinlichkeit mal Durchschnittsverlust.",
      "Verjetnost zmage p krat povprečna zmaga minus verjetnost izgube krat povprečna izguba.",
      "Win probability p times average win minus loss probability times average loss.",
    ),
    workedExample: t(
      "45 % × 2 R − 55 % × 1 R = +0,35 R je Trade.",
      "45 % × 2 R − 55 % × 1 R = +0,35 R na posel.",
      "45% × 2R − 55% × 1R = +0.35R per trade.",
    ),
    interpretation: t(
      "Ein positiver Stichprobenwert ist eine Schätzung, keine Garantie für den nächsten Trade.",
      "Pozitivna vrednost vzorca je ocena, ne jamstvo za naslednji posel.",
      "A positive sample estimate is not a guarantee for the next trade.",
    ),
    commonMistake: t(
      "Durchschnittswerte aus zu wenigen oder selektiv gewählten Trades verwenden.",
      "Uporabiti povprečja iz premalo ali selektivno izbranih poslov.",
      "Using averages from too few or selectively chosen trades.",
    ),
    relatedLesson: { id: "lesson-rm-expectancy", label: t("Erwartungswert", "Pričakovana vrednost", "Expectancy") },
    inputs: [
      numberInput("winRate", t("Trefferquote", "Delež zmag", "Win rate"), "45", { min: 0, max: 100, suffix: percent }),
      numberInput("averageWin", t("Durchschnittsgewinn", "Povprečna zmaga", "Average win"), "2", { min: 0, suffix: t("R", "R", "R") }),
      numberInput("averageLoss", t("Durchschnittsverlust", "Povprečna izguba", "Average loss"), "1", { min: 0, suffix: t("R", "R", "R") }),
    ],
    outputs: [output("expectancy", t("Erwartungswert je Trade", "Pričakovanje na posel", "Expectancy per trade"), "ratio")],
  },
  {
    id: "profit-factor",
    category: "trading",
    title: t("Profit Factor", "Faktor dobička", "Profit factor"),
    summary: t(
      "Vergleiche Bruttogewinne mit Bruttoverlusten derselben Stichprobe.",
      "Primerjaj bruto dobičke in bruto izgube istega vzorca.",
      "Compare gross profits with gross losses from the same sample.",
    ),
    formula: String.raw`PF = \frac{\sum Gewinne}{\lvert\sum Verluste\rvert}`,
    formulaExplanation: t(
      "Gesamte positive Ergebnisse geteilt durch den absoluten Betrag aller negativen Ergebnisse.",
      "Vsota pozitivnih izidov deljeno z absolutno vsoto negativnih izidov.",
      "Total positive outcomes divided by the absolute total of negative outcomes.",
    ),
    workedExample: t(
      "2.400 € Bruttogewinn ÷ 1.600 € Bruttoverlust = 1,50.",
      "2.400 € bruto dobička ÷ 1.600 € bruto izgube = 1,50.",
      "€2,400 gross profit ÷ €1,600 gross loss = 1.50.",
    ),
    interpretation: t(
      "1,50 bedeutet 1,50 € Bruttogewinn je 1 € Bruttoverlust; Kosten und Stichprobe bleiben wichtig.",
      "1,50 pomeni 1,50 € bruto dobička na 1 € bruto izgube; stroški in vzorec ostajajo pomembni.",
      "1.50 means €1.50 gross profit per €1 gross loss; costs and sample quality still matter.",
    ),
    commonMistake: t(
      "Null Verluste als unendlichen, belastbaren Profit Factor ausgeben.",
      "Nič izgub prikazati kot neskončen in zanesljiv faktor dobička.",
      "Reporting zero losses as an infinitely reliable profit factor.",
    ),
    relatedLesson: { id: "lesson-rm-profit-factor", label: t("Profit Factor", "Faktor dobička", "Profit factor") },
    inputs: [
      numberInput("grossProfit", t("Bruttogewinn", "Bruto dobiček", "Gross profit"), "2400", { min: 0, suffix: euro }),
      numberInput("grossLoss", t("Bruttoverlust (positiv)", "Bruto izguba (pozitivno)", "Gross loss (positive)"), "1600", { min: 0, exclusiveMin: true, suffix: euro }),
    ],
    outputs: [output("profitFactor", t("Profit Factor", "Faktor dobička", "Profit factor"), "ratio")],
  },
  {
    id: "drawdown",
    category: "trading",
    title: t("Drawdown", "Padec vrednosti", "Drawdown"),
    summary: t(
      "Messe den prozentualen Rückgang vom Kontohöchststand zum Tief.",
      "Izmeri odstotni padec od vrha računa do dna.",
      "Measure the percentage decline from an equity peak to a trough.",
    ),
    formula: String.raw`DD = \frac{Peak-Tief}{Peak} \times 100\%`,
    formulaExplanation: t(
      "Die absolute Verluststrecke wird auf den vorherigen Höchststand bezogen.",
      "Absolutni padec se deli s prejšnjim vrhom.",
      "The absolute decline is divided by the prior peak.",
    ),
    workedExample: t(
      "Von 10.000 € auf 8.000 €: Drawdown 20 %; zur Erholung sind 25 % nötig.",
      "Z 10.000 € na 8.000 €: padec 20 %; za okrevanje je potrebnih 25 %.",
      "From €10,000 to €8,000: 20% drawdown; 25% recovery is required.",
    ),
    interpretation: t(
      "Die notwendige Erholungsrendite wächst schneller als der Drawdown.",
      "Potrebni donos za okrevanje raste hitreje od padca.",
      "Required recovery return rises faster than the drawdown.",
    ),
    commonMistake: t(
      "Einen Verlust von 20 % mit einem Gewinn von 20 % für vollständig ausgeglichen halten.",
      "Meniti, da 20-odstotni dobiček v celoti izravna 20-odstotno izgubo.",
      "Assuming a 20% gain fully offsets a 20% loss.",
    ),
    relatedLesson: { id: "lesson-rm-drawdown-limits", label: t("Drawdown und Limits", "Padec in omejitve", "Drawdown and limits") },
    inputs: [
      numberInput("peak", t("Höchststand", "Vrh", "Peak equity"), "10000", { min: 0, exclusiveMin: true, suffix: euro }),
      numberInput("trough", t("Tiefstand", "Dno", "Trough equity"), "8000", { min: 0, suffix: euro }),
    ],
    outputs: [
      output("drawdownPercent", t("Drawdown", "Padec", "Drawdown"), "percent"),
      output("recoveryPercent", t("Nötige Erholung", "Potrebno okrevanje", "Required recovery"), "percent"),
    ],
  },
  {
    id: "break-even-win-rate",
    category: "trading",
    title: t("Break-even-Trefferquote", "Prag uspešnosti", "Break-even win rate"),
    summary: t(
      "Finde die Trefferquote, bei der durchschnittliche Gewinne und Verluste sich ausgleichen.",
      "Poišči delež zmag, pri katerem se povprečne zmage in izgube izenačijo.",
      "Find the win rate where average wins and losses balance.",
    ),
    formula: String.raw`p_{BE} = \frac{\bar{L}}{\bar{W}+\bar{L}}`,
    formulaExplanation: t(
      "Durchschnittsverlust geteilt durch die Summe aus Durchschnittsgewinn und -verlust.",
      "Povprečna izguba deljeno z vsoto povprečne zmage in izgube.",
      "Average loss divided by average win plus average loss.",
    ),
    workedExample: t(
      "Durchschnittlich +2 R und −1 R: 1 ÷ (2 + 1) = 33,33 %.",
      "Povprečno +2 R in −1 R: 1 ÷ (2 + 1) = 33,33 %.",
      "Average +2R and −1R: 1 ÷ (2 + 1) = 33.33%.",
    ),
    interpretation: t(
      "Über dieser Quote ist der modellierte Erwartungswert vor Kosten positiv.",
      "Nad tem deležem je modelirana pričakovana vrednost pred stroški pozitivna.",
      "Above this rate, modelled expectancy before costs is positive.",
    ),
    commonMistake: t(
      "Gebühren, Slippage und Veränderungen der Gewinn-/Verlustgröße ignorieren.",
      "Prezreti provizije, zdrs in spremembe velikosti zmag ali izgub.",
      "Ignoring fees, slippage, and changes in win or loss size.",
    ),
    relatedLesson: { id: "lesson-rm-expectancy", label: t("Erwartungswert", "Pričakovana vrednost", "Expectancy") },
    inputs: [
      numberInput("averageWin", t("Durchschnittsgewinn", "Povprečna zmaga", "Average win"), "2", { min: 0, exclusiveMin: true, suffix: t("R", "R", "R") }),
      numberInput("averageLoss", t("Durchschnittsverlust", "Povprečna izguba", "Average loss"), "1", { min: 0, exclusiveMin: true, suffix: t("R", "R", "R") }),
    ],
    outputs: [output("breakEvenWinRate", t("Break-even-Quote", "Prag uspešnosti", "Break-even rate"), "percent")],
  },
  {
    id: "leverage-margin",
    category: "trading",
    title: t("Hebel und Margin", "Vzvod in kritje", "Leverage and margin"),
    summary: t(
      "Setze Markt-Exposure ins Verhältnis zum eingesetzten Eigenkapital.",
      "Primerjaj tržno izpostavljenost z uporabljenim lastnim kapitalom.",
      "Relate market exposure to the equity committed.",
    ),
    formula: String.raw`Hebel = \frac{Exposure}{Eigenkapital},\quad Margin\% = \frac{Eigenkapital}{Exposure}\times100`,
    formulaExplanation: t(
      "Hebel und Margin-Anteil sind Kehrwerte, solange dieselbe Exposure-Basis verwendet wird.",
      "Vzvod in delež kritja sta ob isti osnovi izpostavljenosti obratni vrednosti.",
      "Leverage and margin fraction are reciprocals when measured on the same exposure basis.",
    ),
    workedExample: t(
      "50.000 € Exposure mit 10.000 € Eigenkapital = 5× Hebel und 20 % Margin.",
      "50.000 € izpostavljenosti z 10.000 € kapitala = 5× vzvod in 20 % kritje.",
      "€50,000 exposure with €10,000 equity = 5× leverage and 20% margin.",
    ),
    interpretation: t(
      "Bei 5× Hebel entspricht eine Marktbewegung von 1 % etwa 5 % des Eigenkapitals vor Kosten.",
      "Pri 5× vzvodu 1-odstotni premik trga pomeni približno 5 % kapitala pred stroški.",
      "At 5× leverage, a 1% market move is roughly 5% of equity before costs.",
    ),
    commonMistake: t(
      "Margin mit maximal vertretbarem Verlust verwechseln.",
      "Zamenjati kritje z največjo sprejemljivo izgubo.",
      "Confusing margin posted with maximum acceptable loss.",
    ),
    relatedLesson: { id: "lesson-tf-margin-leverage", label: t("Margin und Hebel", "Kritje in vzvod", "Margin and leverage") },
    inputs: [
      numberInput("exposure", t("Positionswert", "Vrednost pozicije", "Position value"), "50000", { min: 0, exclusiveMin: true, suffix: euro }),
      numberInput("equity", t("Eigenkapital", "Lastni kapital", "Equity committed"), "10000", { min: 0, exclusiveMin: true, suffix: euro }),
    ],
    outputs: [
      output("leverage", t("Hebel", "Vzvod", "Leverage"), "ratio"),
      output("marginPercent", t("Margin-Anteil", "Delež kritja", "Margin fraction"), "percent"),
    ],
  },
  {
    id: "compound-interest",
    category: "finance",
    title: t("Zinseszins", "Obrestno-obrestni račun", "Compound interest"),
    summary: t(
      "Berechne den Endwert einer einmaligen Anlage mit unterjähriger Verzinsung.",
      "Izračunaj prihodnjo vrednost enkratne naložbe z obrestovanjem med letom.",
      "Calculate the future value of a lump sum with within-year compounding.",
    ),
    formula: String.raw`FV = PV\left(1+\frac{r}{m}\right)^{mt}`,
    formulaExplanation: t(
      "Barwert PV wächst mit Periodenzins r/m über m mal t Zinsperioden.",
      "Sedanja vrednost PV raste s periodično mero r/m skozi m krat t obdobij.",
      "Present value PV grows at periodic rate r/m over m times t compounding periods.",
    ),
    workedExample: t(
      "1.000 € bei 5 % jährlich für 3 Jahre: 1.157,63 €.",
      "1.000 € pri 5 % letno za 3 leta: 1.157,63 €.",
      "€1,000 at 5% annually for 3 years: €1,157.63.",
    ),
    interpretation: t(
      "Das ist ein Modellwert bei konstantem Zinssatz, keine garantierte Anlagerendite.",
      "To je modelna vrednost ob stalni meri, ne zagotovljen donos naložbe.",
      "This is a model value at a constant rate, not a guaranteed investment return.",
    ),
    commonMistake: t(
      "5 statt 0,05 in die Formel einsetzen oder Perioden und Rate mischen.",
      "V formulo vnesti 5 namesto 0,05 ali mešati obdobja in mero.",
      "Entering 5 instead of 0.05 or mixing rate and period units.",
    ),
    relatedLesson: { id: "lesson-ff-time-value", label: t("Zeitwert des Geldes", "Časovna vrednost denarja", "Time value of money") },
    inputs: [
      numberInput("principal", t("Anfangskapital", "Začetni kapital", "Principal"), "1000", { min: 0, suffix: euro }),
      numberInput("annualRate", t("Jahreszins", "Letna mera", "Annual rate"), "5", { min: -100, exclusiveMin: true, suffix: percent }),
      numberInput("years", t("Jahre", "Leta", "Years"), "3", { min: 0, suffix: t("Jahre", "leta", "years") }),
      numberInput("compounds", t("Perioden pro Jahr", "Obdobij na leto", "Compounds per year"), "1", { min: 1, integer: true }),
    ],
    outputs: [output("futureValue", t("Endwert", "Prihodnja vrednost", "Future value"), "currency")],
  },
  {
    id: "present-value",
    category: "finance",
    title: t("Barwert", "Sedanja vrednost", "Present value"),
    summary: t(
      "Diskontiere einen zukünftigen Betrag auf heute.",
      "Diskontiraj prihodnji znesek na današnjo vrednost.",
      "Discount a future amount back to today.",
    ),
    formula: String.raw`PV = \frac{FV}{(1+r)^n}`,
    formulaExplanation: t(
      "Der Zukunftswert FV wird durch den Wachstumsfaktor über n Perioden geteilt.",
      "Prihodnja vrednost FV se deli s faktorjem rasti skozi n obdobij.",
      "Future value FV is divided by the growth factor over n periods.",
    ),
    workedExample: t(
      "1.157,63 € in 3 Jahren bei 5 % entsprechen heute rund 1.000 €.",
      "1.157,63 € čez 3 leta pri 5 % je danes približno 1.000 €.",
      "€1,157.63 in 3 years at 5% is worth about €1,000 today.",
    ),
    interpretation: t(
      "Ein höherer Diskontsatz senkt den heutigen Modellwert zukünftiger Zahlungen.",
      "Višja diskontna mera zniža današnjo modelno vrednost prihodnjih plačil.",
      "A higher discount rate lowers the modelled present value of future cash.",
    ),
    commonMistake: t(
      "Nominale Jahresrate mit monatlichen Perioden ohne Umrechnung kombinieren.",
      "Združiti letno nominalno mero z mesečnimi obdobji brez pretvorbe.",
      "Combining an annual rate with monthly periods without conversion.",
    ),
    relatedLesson: { id: "lesson-ff-time-value", label: t("Zeitwert des Geldes", "Časovna vrednost denarja", "Time value of money") },
    inputs: [
      numberInput("futureValue", t("Zukunftswert", "Prihodnja vrednost", "Future value"), "1157.625", { min: 0, suffix: euro }),
      numberInput("rate", t("Diskontsatz je Periode", "Diskontna mera na obdobje", "Discount rate per period"), "5", { min: -100, exclusiveMin: true, suffix: percent }),
      numberInput("periods", t("Perioden", "Obdobja", "Periods"), "3", { min: 0 }),
    ],
    outputs: [output("presentValue", t("Barwert", "Sedanja vrednost", "Present value"), "currency")],
  },
  {
    id: "future-value",
    category: "finance",
    title: t("Zukunftswert mit Sparrate", "Prihodnja vrednost z vplačili", "Future value with contributions"),
    summary: t(
      "Projiziere Startkapital und gleichbleibende Zahlungen am Periodenende.",
      "Projiciraj začetni kapital in enaka vplačila ob koncu obdobja.",
      "Project starting capital and equal end-of-period contributions.",
    ),
    formula: String.raw`FV = PV(1+r)^n + PMT\frac{(1+r)^n-1}{r}`,
    formulaExplanation: t(
      "Der erste Term wächst das Startkapital, der zweite summiert eine nachschüssige Zahlungsreihe.",
      "Prvi člen poveča začetni kapital, drugi sešteje vplačila ob koncu obdobij.",
      "The first term grows starting capital; the second accumulates an ordinary annuity.",
    ),
    workedExample: t(
      "1.000 € Start plus 100 € am Jahresende, 5 % und 3 Perioden: 1.472,88 €.",
      "1.000 € začetno plus 100 € ob koncu leta, 5 % in 3 obdobja: 1.472,88 €.",
      "€1,000 initially plus €100 at each year-end, 5% and 3 periods: €1,472.88.",
    ),
    interpretation: t(
      "Der Zeitpunkt der Einzahlung verändert das Ergebnis; hier erfolgen Beiträge am Periodenende.",
      "Čas vplačila spremeni rezultat; tukaj so vplačila ob koncu obdobja.",
      "Contribution timing changes the result; here payments occur at period end.",
    ),
    commonMistake: t(
      "Vorschüssige und nachschüssige Zahlungen ohne Anpassung gleich behandeln.",
      "Brez prilagoditve enačiti vplačila na začetku in koncu obdobja.",
      "Treating beginning- and end-of-period payments as identical.",
    ),
    relatedLesson: { id: "lesson-ff-time-value", label: t("Zeitwert des Geldes", "Časovna vrednost denarja", "Time value of money") },
    inputs: [
      numberInput("presentValue", t("Startkapital", "Začetni kapital", "Starting capital"), "1000", { min: 0, suffix: euro }),
      numberInput("payment", t("Zahlung je Periode", "Vplačilo na obdobje", "Contribution per period"), "100", { min: 0, suffix: euro }),
      numberInput("rate", t("Rendite je Periode", "Donos na obdobje", "Return per period"), "5", { min: -100, exclusiveMin: true, suffix: percent }),
      numberInput("periods", t("Perioden", "Obdobja", "Periods"), "3", { min: 0, integer: true }),
    ],
    outputs: [output("futureValue", t("Zukunftswert", "Prihodnja vrednost", "Future value"), "currency")],
  },
  {
    id: "npv",
    category: "finance",
    title: t("Kapitalwert (NPV)", "Neto sedanja vrednost (NPV)", "Net present value (NPV)"),
    summary: t(
      "Bewerte eine Anfangsauszahlung, konstante Jahres-Cashflows und einen Endwert.",
      "Oceni začetni izdatek, enake letne denarne tokove in končno vrednost.",
      "Value an initial outlay, level annual cash flows, and a terminal amount.",
    ),
    formula: String.raw`NPV = -I_0 + \sum_{t=1}^{n}\frac{CF}{(1+r)^t}+\frac{TV}{(1+r)^n}`,
    formulaExplanation: t(
      "Alle zukünftigen Cashflows werden mit demselben periodengerechten Satz diskontiert und mit der Anfangsauszahlung verrechnet.",
      "Vsi prihodnji tokovi se diskontirajo z isto ustrezno mero in pobotajo z začetnim izdatkom.",
      "All future cash flows are discounted at the same period-consistent rate and netted against the initial outlay.",
    ),
    workedExample: t(
      "1.000 € Einsatz, drei Zahlungen à 400 €, kein Endwert, 10 %: NPV ≈ −5,26 €.",
      "1.000 € vložka, tri plačila po 400 €, brez končne vrednosti, 10 %: NPV ≈ −5,26 €.",
      "€1,000 outlay, three €400 payments, no terminal value, 10%: NPV ≈ −€5.26.",
    ),
    interpretation: t(
      "Ein positiver Modell-NPV bedeutet Wert über der gewählten Mindestverzinsung, nicht sichere Profitabilität.",
      "Pozitiven modelni NPV pomeni vrednost nad izbrano zahtevano mero, ne zagotovljene donosnosti.",
      "A positive model NPV means value above the chosen hurdle rate, not certain profitability.",
    ),
    commonMistake: t(
      "Nominale und reale Cashflows oder Zeitperioden inkonsistent mischen.",
      "Nedosledno mešati nominalne in realne tokove ali obdobja.",
      "Mixing nominal and real cash flows or inconsistent periods.",
    ),
    relatedLesson: { id: "lesson-ff-time-value", label: t("Zeitwert des Geldes", "Časovna vrednost denarja", "Time value of money") },
    inputs: [
      numberInput("initialInvestment", t("Anfangsauszahlung", "Začetni izdatek", "Initial outlay"), "1000", { min: 0, suffix: euro }),
      numberInput("annualCashFlow", t("Jährlicher Cashflow", "Letni denarni tok", "Annual cash flow"), "400", { suffix: euro }),
      numberInput("terminalValue", t("Endwert", "Končna vrednost", "Terminal amount"), "0", { suffix: euro }),
      numberInput("discountRate", t("Diskontsatz", "Diskontna mera", "Discount rate"), "10", { min: -100, exclusiveMin: true, suffix: percent }),
      numberInput("years", t("Jahre", "Leta", "Years"), "3", { min: 1, integer: true }),
    ],
    outputs: [output("npv", t("Kapitalwert", "Neto sedanja vrednost", "Net present value"), "currency")],
  },
  {
    id: "irr",
    category: "finance",
    title: t("Interner Zinsfuß (IRR)", "Notranja stopnja donosnosti (IRR)", "Internal rate of return (IRR)"),
    summary: t(
      "Finde den Diskontsatz, bei dem der Kapitalwert einer konventionellen Zahlungsreihe null ist.",
      "Poišči diskontno mero, pri kateri je NPV običajnega toka enak nič.",
      "Find the discount rate that sets NPV of a conventional cash-flow series to zero.",
    ),
    formula: String.raw`0 = \sum_{t=0}^{n}\frac{CF_t}{(1+IRR)^t}`,
    formulaExplanation: t(
      "Eine begrenzte Bisektion sucht reproduzierbar zwischen −99,99 % und 1.000 %; nicht eindeutige Zahlungsreihen werden abgelehnt.",
      "Omejena bisekcija ponovljivo išče med −99,99 % in 1.000 %; neenolični tokovi so zavrnjeni.",
      "Bounded bisection searches reproducibly between −99.99% and 1,000%; non-conventional series are rejected.",
    ),
    workedExample: t(
      "−1.000 €; 400 €; 400 €; 400 € ergibt IRR ≈ 9,70 %.",
      "−1.000 €; 400 €; 400 €; 400 € da IRR ≈ 9,70 %.",
      "−€1,000; €400; €400; €400 gives IRR ≈ 9.70%.",
    ),
    interpretation: t(
      "IRR ist mit der Hurdle Rate vergleichbar, kann aber bei ungewöhnlichen Vorzeichen mehrere Lösungen haben.",
      "IRR se primerja z zahtevano mero, vendar ima lahko pri nenavadnih predznakih več rešitev.",
      "IRR can be compared with a hurdle rate, but unusual sign patterns can create multiple solutions.",
    ),
    commonMistake: t(
      "Mehrere mögliche IRRs ignorieren oder IRR als absolute Wertschöpfung lesen.",
      "Prezreti več možnih IRR ali IRR razumeti kot absolutno ustvarjeno vrednost.",
      "Ignoring multiple possible IRRs or reading IRR as absolute value created.",
    ),
    relatedLesson: { id: "lesson-ff-time-value", label: t("Zeitwert des Geldes", "Časovna vrednost denarja", "Time value of money") },
    inputs: [
      seriesInput(
        "cashFlows",
        t("Cashflows ab t=0", "Denarni tokovi od t=0", "Cash flows from t=0"),
        "-1000; 400; 400; 400",
        t("Mit Semikolon trennen; mindestens ein negativer und ein positiver Wert.", "Loči s podpičjem; vsaj ena negativna in ena pozitivna vrednost.", "Separate with semicolons; include at least one negative and one positive value."),
      ),
    ],
    outputs: [output("irrPercent", t("Interner Zinsfuß", "Notranja stopnja donosnosti", "Internal rate of return"), "percent", 4)],
  },
  {
    id: "bond-price",
    category: "finance",
    title: t("Anleihepreis", "Cena obveznice", "Bond price"),
    summary: t(
      "Diskontiere Kupons und Nennwert mit einer konstanten Marktrendite.",
      "Diskontiraj kupone in nominalo s stalnim tržnim donosom.",
      "Discount coupons and principal at a constant market yield.",
    ),
    formula: String.raw`P = \sum_{t=1}^{N}\frac{C}{(1+y/m)^t}+\frac{F}{(1+y/m)^N}`,
    formulaExplanation: t(
      "Jeder periodische Kupon C und der Nennwert F werden mit der Rendite je Kuponperiode diskontiert.",
      "Vsak periodični kupon C in nominala F se diskontirata z donosom na kuponsko obdobje.",
      "Each periodic coupon C and face value F are discounted at yield per coupon period.",
    ),
    workedExample: t(
      "1.000 € Nennwert, 5 % Kupon, 5 % Rendite, 5 Jahre, jährlich: Preis 1.000 €.",
      "1.000 € nominale, 5 % kupon, 5 % donos, 5 let, letno: cena 1.000 €.",
      "€1,000 face, 5% coupon, 5% yield, 5 years, annual: price €1,000.",
    ),
    interpretation: t(
      "Steigt die Marktrendite über den Kupon, fällt der Modellpreis unter pari.",
      "Ko tržni donos preseže kupon, modelna cena pade pod nominalo.",
      "When market yield rises above the coupon rate, model price falls below par.",
    ),
    commonMistake: t(
      "Jahreskupon und halbjährliche Renditeperioden ohne Umrechnung mischen.",
      "Mešati letni kupon in polletna obdobja donosa brez pretvorbe.",
      "Mixing an annual coupon with semiannual yield periods without conversion.",
    ),
    relatedLesson: { id: "lesson-ff-stocks-bonds", label: t("Aktien und Anleihen", "Delnice in obveznice", "Stocks and bonds") },
    inputs: [
      numberInput("faceValue", t("Nennwert", "Nominalna vrednost", "Face value"), "1000", { min: 0, exclusiveMin: true, suffix: euro }),
      numberInput("couponRate", t("Jahreskupon", "Letni kupon", "Annual coupon rate"), "5", { min: 0, suffix: percent }),
      numberInput("yieldRate", t("Marktrendite", "Tržni donos", "Market yield"), "5", { min: -100, exclusiveMin: true, suffix: percent }),
      numberInput("years", t("Jahre", "Leta", "Years"), "5", { min: 1, integer: true }),
      numberInput("frequency", t("Kupons pro Jahr", "Kuponov na leto", "Coupons per year"), "1", { min: 1, max: 12, integer: true }),
    ],
    outputs: [output("bondPrice", t("Modellpreis", "Modelna cena", "Model price"), "currency")],
  },
  {
    id: "yield",
    category: "finance",
    title: t("Laufende Rendite", "Tekoči donos", "Current yield"),
    summary: t(
      "Setze den Jahreskupon ins Verhältnis zum aktuellen Anleihepreis.",
      "Primerjaj letni kupon s trenutno ceno obveznice.",
      "Relate the annual coupon to the bond's current price.",
    ),
    formula: String.raw`Laufende\ Rendite = \frac{Jahreskupon}{Marktpreis}`,
    formulaExplanation: t(
      "Der Jahreskupon ist Nennwert mal Kuponrate; Kursgewinne und Rückzahlung sind nicht enthalten.",
      "Letni kupon je nominala krat kuponska mera; kapitalski dobiček in vračilo nista vključena.",
      "Annual coupon is face value times coupon rate; capital gain and redemption are excluded.",
    ),
    workedExample: t(
      "1.000 € Nennwert, 5 % Kupon und 950 € Preis: 50 ÷ 950 = 5,26 %.",
      "1.000 € nominale, 5 % kupon in cena 950 €: 50 ÷ 950 = 5,26 %.",
      "€1,000 face, 5% coupon and €950 price: 50 ÷ 950 = 5.26%.",
    ),
    interpretation: t(
      "Die laufende Rendite ist nicht die Rendite bis Fälligkeit.",
      "Tekoči donos ni donos do dospetja.",
      "Current yield is not yield to maturity.",
    ),
    commonMistake: t(
      "Die laufende Rendite als vollständige Gesamtrendite ausgeben.",
      "Tekoči donos prikazati kot celoten skupni donos.",
      "Reporting current yield as complete total return.",
    ),
    relatedLesson: { id: "lesson-ff-stocks-bonds", label: t("Aktien und Anleihen", "Delnice in obveznice", "Stocks and bonds") },
    inputs: [
      numberInput("faceValue", t("Nennwert", "Nominalna vrednost", "Face value"), "1000", { min: 0, exclusiveMin: true, suffix: euro }),
      numberInput("couponRate", t("Jahreskupon", "Letni kupon", "Annual coupon rate"), "5", { min: 0, suffix: percent }),
      numberInput("marketPrice", t("Marktpreis", "Tržna cena", "Market price"), "950", { min: 0, exclusiveMin: true, suffix: euro }),
    ],
    outputs: [output("currentYield", t("Laufende Rendite", "Tekoči donos", "Current yield"), "percent")],
  },
  {
    id: "capm",
    category: "finance",
    title: t("CAPM-Rendite", "Donos CAPM", "CAPM return"),
    summary: t(
      "Schätze die geforderte Eigenkapitalrendite aus risikofreiem Satz, Beta und Marktprämie.",
      "Oceni zahtevani donos lastniškega kapitala iz netvegane mere, bete in tržne premije.",
      "Estimate required equity return from the risk-free rate, beta, and market premium.",
    ),
    formula: String.raw`E(R_i)=R_f+\beta_i\left(E(R_m)-R_f\right)`,
    formulaExplanation: t(
      "Beta skaliert die angenommene Markt-Risikoprämie und wird zum risikofreien Satz addiert.",
      "Beta prilagodi predpostavljeno tržno premijo za tveganje, ki se prišteje netvegani meri.",
      "Beta scales the assumed market risk premium, which is added to the risk-free rate.",
    ),
    workedExample: t(
      "Risikofrei 3 %, Beta 1,2, Markt 8 %: 3 % + 1,2 × 5 % = 9 %.",
      "Netvegano 3 %, beta 1,2, trg 8 %: 3 % + 1,2 × 5 % = 9 %.",
      "Risk-free 3%, beta 1.2, market 8%: 3% + 1.2 × 5% = 9%.",
    ),
    interpretation: t(
      "Das Ergebnis hängt vollständig von Beta- und Prämienannahmen ab.",
      "Rezultat je v celoti odvisen od predpostavk o beti in premiji.",
      "The result depends entirely on beta and premium assumptions.",
    ),
    commonMistake: t(
      "Historisches Beta als stabile physikalische Eigenschaft behandeln.",
      "Zgodovinsko beto obravnavati kot stalno fizično lastnost.",
      "Treating historical beta as a stable physical property.",
    ),
    relatedLesson: { id: "lesson-ff-risk-return", label: t("Risiko und Rendite", "Tveganje in donos", "Risk and return") },
    inputs: [
      numberInput("riskFreeRate", t("Risikofreier Satz", "Netvegana mera", "Risk-free rate"), "3", { min: -100, suffix: percent }),
      numberInput("beta", t("Beta", "Beta", "Beta"), "1.2", { min: -10, max: 10 }),
      numberInput("marketReturn", t("Erwartete Marktrendite", "Pričakovani tržni donos", "Expected market return"), "8", { min: -100, suffix: percent }),
    ],
    outputs: [output("expectedReturn", t("Geforderte Rendite", "Zahtevani donos", "Required return"), "percent")],
  },
  {
    id: "wacc",
    category: "finance",
    title: t("WACC", "WACC", "WACC"),
    summary: t(
      "Gewichte Eigen- und Fremdkapitalkosten nach Marktwert und Steuereffekt.",
      "Uteži stroške lastniškega in dolžniškega kapitala po tržni vrednosti in davku.",
      "Weight equity and debt costs by market value and the debt tax shield.",
    ),
    formula: String.raw`WACC = \frac{E}{D+E}R_e + \frac{D}{D+E}R_d(1-T)`,
    formulaExplanation: t(
      "Eigen- und Fremdkapitalkosten werden nach ihren Marktwertanteilen gewichtet; Fremdkapital wird nach Steuer berücksichtigt.",
      "Stroški kapitala in dolga so uteženi po tržnih deležih; dolg se upošteva po davku.",
      "Equity and debt costs are weighted by market value; debt cost is adjusted after tax.",
    ),
    workedExample: t(
      "60 Mio. € Eigenkapital zu 10 %, 40 Mio. € Schulden zu 5 %, Steuer 25 %: WACC 7,50 %.",
      "60 mio. € kapitala pri 10 %, 40 mio. € dolga pri 5 %, davek 25 %: WACC 7,50 %.",
      "€60m equity at 10%, €40m debt at 5%, tax 25%: WACC 7.50%.",
    ),
    interpretation: t(
      "WACC kann als Diskontsatz für Cashflows mit vergleichbarem Geschäfts- und Finanzierungsrisiko dienen.",
      "WACC je lahko diskontna mera za tokove s primerljivim poslovnim in finančnim tveganjem.",
      "WACC can discount cash flows with comparable business and financing risk.",
    ),
    commonMistake: t(
      "Buchwerte statt Marktwerte verwenden oder den Steuereffekt doppelt zählen.",
      "Uporabiti knjigovodske namesto tržnih vrednosti ali dvakrat šteti davčni učinek.",
      "Using book rather than market values or counting the tax shield twice.",
    ),
    relatedLesson: { id: "lesson-ff-finance-map", label: t("Was Finanzen leisten", "Kaj omogočajo finance", "What finance does") },
    inputs: [
      numberInput("equityValue", t("Marktwert Eigenkapital", "Tržna vrednost kapitala", "Market value of equity"), "60", { min: 0, suffix: t("Mio. €", "mio. €", "€m") }),
      numberInput("debtValue", t("Marktwert Schulden", "Tržna vrednost dolga", "Market value of debt"), "40", { min: 0, suffix: t("Mio. €", "mio. €", "€m") }),
      numberInput("costEquity", t("Eigenkapitalkosten", "Strošek kapitala", "Cost of equity"), "10", { min: -100, suffix: percent }),
      numberInput("costDebt", t("Fremdkapitalkosten", "Strošek dolga", "Cost of debt"), "5", { min: -100, suffix: percent }),
      numberInput("taxRate", t("Steuersatz", "Davčna stopnja", "Tax rate"), "25", { min: 0, max: 100, suffix: percent }),
    ],
    outputs: [output("wacc", t("WACC", "WACC", "WACC"), "percent")],
  },
  {
    id: "basic-dcf",
    category: "finance",
    title: t("Einfaches DCF", "Osnovni DCF", "Basic DCF"),
    summary: t(
      "Diskontiere wachsende freie Cashflows und einen Gordon-Endwert.",
      "Diskontiraj rastoče proste denarne tokove in Gordonovo končno vrednost.",
      "Discount growing free cash flows and a Gordon terminal value.",
    ),
    formula: String.raw`EV = \sum_{t=1}^{n}\frac{FCF_0(1+g)^t}{(1+r)^t}+\frac{FCF_n(1+g_T)}{(r-g_T)(1+r)^n}`,
    formulaExplanation: t(
      "Explizite Cashflows wachsen mit g; der Endwert nutzt eine niedrigere ewige Rate gT unter dem Diskontsatz r.",
      "Izrecni tokovi rastejo z g; končna vrednost uporablja nižjo večno rast gT od diskontne mere r.",
      "Explicit cash flows grow at g; terminal value uses perpetual growth gT below discount rate r.",
    ),
    workedExample: t(
      "100 € FCF, 5 % Wachstum, 5 Jahre, 10 % Diskontsatz, 2 % Endwachstum: Unternehmenswert ≈ 1.446,21 €.",
      "100 € FCF, 5 % rast, 5 let, 10 % diskontna mera, 2 % končna rast: vrednost ≈ 1.446,21 €.",
      "€100 FCF, 5% growth, 5 years, 10% discount, 2% terminal growth: enterprise value ≈ €1,446.21.",
    ),
    interpretation: t(
      "DCF reagiert stark auf kleine Änderungen von Diskontsatz und Endwachstum; nutze Szenarien.",
      "DCF je zelo občutljiv na majhne spremembe diskontne mere in končne rasti; uporabi scenarije.",
      "DCF is highly sensitive to small changes in discount rate and terminal growth; use scenarios.",
    ),
    commonMistake: t(
      "Endwachstum mindestens so hoch wie den Diskontsatz ansetzen.",
      "Nastaviti končno rast enako ali višje od diskontne mere.",
      "Setting terminal growth equal to or above the discount rate.",
    ),
    relatedLesson: { id: "lesson-ff-time-value", label: t("Zeitwert des Geldes", "Časovna vrednost denarja", "Time value of money") },
    inputs: [
      numberInput("currentFcf", t("Aktueller freier Cashflow", "Trenutni prosti denarni tok", "Current free cash flow"), "100", { suffix: euro }),
      numberInput("growthRate", t("Wachstum im Detailzeitraum", "Rast v napovedi", "Explicit growth rate"), "5", { min: -100, exclusiveMin: true, suffix: percent }),
      numberInput("years", t("Detailjahre", "Leta napovedi", "Explicit years"), "5", { min: 1, max: 50, integer: true }),
      numberInput("discountRate", t("Diskontsatz", "Diskontna mera", "Discount rate"), "10", { min: -100, exclusiveMin: true, suffix: percent }),
      numberInput("terminalGrowth", t("Ewiges Wachstum", "Večna rast", "Terminal growth"), "2", { min: -100, exclusiveMin: true, suffix: percent }),
    ],
    outputs: [output("enterpriseValue", t("Unternehmenswert", "Vrednost podjetja", "Enterprise value"), "currency")],
  },
] as const;

const definitionById = new Map(CALCULATORS.map((definition) => [definition.id, definition]));

export function getCalculator(id: CalculatorId): CalculatorDefinition {
  const definition = definitionById.get(id);
  if (!definition) throw new Error(`Unknown calculator: ${id}`);
  return definition;
}

export function defaultInputs(definition: CalculatorDefinition): Record<string, string> {
  return Object.fromEntries(definition.inputs.map((input) => [input.key, input.defaultValue]));
}

export function parseLocalizedNumber(raw: string): number | null {
  const normalized = raw.trim().replaceAll(" ", "").replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseSeries(raw: string): number[] | null {
  const parts = raw
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const values = parts.map(parseLocalizedNumber);
  return values.every((value): value is number => value !== null) ? values : null;
}

function parseInputs(
  definition: CalculatorDefinition,
  rawInputs: Record<string, string>,
): CalculationOutcome | { ok: true; parsed: ParsedInputs } {
  const parsed: ParsedInputs = {};
  const issues: ValidationIssue[] = [];
  for (const input of definition.inputs) {
    const raw = rawInputs[input.key]?.trim() ?? "";
    if (!raw) {
      issues.push({ code: "required", field: input.key });
      continue;
    }
    if (input.kind === "series") {
      const values = parseSeries(raw);
      if (!values) issues.push({ code: "invalidSeries", field: input.key });
      else parsed[input.key] = values;
      continue;
    }
    const value = parseLocalizedNumber(raw);
    if (value === null) {
      issues.push({ code: "invalidNumber", field: input.key });
      continue;
    }
    if (input.min !== undefined) {
      if (input.exclusiveMin && value <= input.min) {
        issues.push({ code: "exclusiveMinimum", field: input.key, limit: input.min });
      } else if (!input.exclusiveMin && value < input.min) {
        issues.push({ code: "minimum", field: input.key, limit: input.min });
      }
    }
    if (input.max !== undefined && value > input.max) {
      issues.push({ code: "maximum", field: input.key, limit: input.max });
    }
    if (input.integer && !Number.isInteger(value)) {
      issues.push({ code: "integer", field: input.key });
    }
    parsed[input.key] = value;
  }
  return issues.length ? { ok: false, issues } : { ok: true, parsed };
}

function numberAt(inputs: ParsedInputs, key: string): number {
  return inputs[key] as number;
}

function seriesAt(inputs: ParsedInputs, key: string): number[] {
  return inputs[key] as number[];
}

export function stableSum(values: readonly number[]): number {
  let total = 0;
  let compensation = 0;
  for (const value of values) {
    const adjusted = value - compensation;
    const next = total + adjusted;
    compensation = next - total - adjusted;
    total = next;
  }
  return total;
}

export function npvAtRate(cashFlows: readonly number[], rate: number): number {
  return stableSum(cashFlows.map((cashFlow, index) => cashFlow / (1 + rate) ** index));
}

type IrrOptions = { maxIterations?: number; tolerance?: number; scanSteps?: number };

export function solveIrr(
  cashFlows: readonly number[],
  options: IrrOptions = {},
): { ok: true; rate: number } | { ok: false; code: "cashFlowSigns" | "multipleIrr" | "irrBracket" | "irrConvergence" } {
  if (!cashFlows.some((value) => value < 0) || !cashFlows.some((value) => value > 0)) {
    return { ok: false, code: "cashFlowSigns" };
  }
  const nonZeroSigns = cashFlows.filter((value) => value !== 0).map((value) => Math.sign(value));
  const signChanges = nonZeroSigns.slice(1).reduce(
    (count, sign, index) => count + (sign !== nonZeroSigns[index] ? 1 : 0),
    0,
  );
  if (signChanges > 1) return { ok: false, code: "multipleIrr" };

  const lowerBound = -0.9999;
  const upperBound = 10;
  const scanSteps = options.scanSteps ?? 512;
  let low = lowerBound;
  let lowValue = npvAtRate(cashFlows, low);
  let high = upperBound;
  let highValue = npvAtRate(cashFlows, high);
  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) {
    return { ok: false, code: "irrBracket" };
  }
  if (lowValue === 0) return { ok: true, rate: low };
  if (highValue === 0) return { ok: true, rate: high };

  if (Math.sign(lowValue) === Math.sign(highValue)) {
    let previousRate = lowerBound;
    let previousValue = lowValue;
    let bracketed = false;
    for (let step = 1; step <= scanSteps; step += 1) {
      const candidateRate = lowerBound + ((upperBound - lowerBound) * step) / scanSteps;
      const candidateValue = npvAtRate(cashFlows, candidateRate);
      if (Number.isFinite(candidateValue) && Math.sign(previousValue) !== Math.sign(candidateValue)) {
        low = previousRate;
        lowValue = previousValue;
        high = candidateRate;
        highValue = candidateValue;
        bracketed = true;
        break;
      }
      previousRate = candidateRate;
      previousValue = candidateValue;
    }
    if (!bracketed) return { ok: false, code: "irrBracket" };
  }

  const maxIterations = options.maxIterations ?? 200;
  const tolerance = options.tolerance ?? 1e-10;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const midpoint = (low + high) / 2;
    const value = npvAtRate(cashFlows, midpoint);
    if (!Number.isFinite(value)) return { ok: false, code: "irrConvergence" };
    if (Math.abs(value) <= tolerance || Math.abs(high - low) <= tolerance) {
      return { ok: true, rate: midpoint };
    }
    if (Math.sign(value) === Math.sign(lowValue)) {
      low = midpoint;
      lowValue = value;
    } else {
      high = midpoint;
      highValue = value;
    }
  }
  void highValue;
  return { ok: false, code: "irrConvergence" };
}

function evaluate(
  id: CalculatorId,
  inputs: ParsedInputs,
): CalculationOutcome {
  const n = (key: string) => numberAt(inputs, key);
  let values: Record<string, number>;
  switch (id) {
    case "position-size": {
      const distance = Math.abs(n("entry") - n("stop"));
      if (distance === 0) return { ok: false, issues: [{ code: "entryStopDifferent", field: "stop" }] };
      values = { units: (n("account") * (n("riskPercent") / 100)) / distance };
      break;
    }
    case "reward-risk": {
      const entry = n("entry");
      const stop = n("stop");
      const target = n("target");
      if (entry === stop) return { ok: false, issues: [{ code: "entryStopDifferent", field: "stop" }] };
      if ((entry - stop) * (target - entry) <= 0) {
        return { ok: false, issues: [{ code: "oppositeSides", field: "target" }] };
      }
      values = { ratio: Math.abs(target - entry) / Math.abs(entry - stop) };
      break;
    }
    case "r-multiple": {
      const entry = n("entry");
      const stop = n("stop");
      if (entry === stop) return { ok: false, issues: [{ code: "entryStopDifferent", field: "stop" }] };
      const direction = stop < entry ? 1 : -1;
      values = { rMultiple: (direction * (n("exit") - entry)) / Math.abs(entry - stop) };
      break;
    }
    case "expectancy": {
      const winProbability = n("winRate") / 100;
      values = {
        expectancy:
          winProbability * n("averageWin") - (1 - winProbability) * n("averageLoss"),
      };
      break;
    }
    case "profit-factor":
      values = { profitFactor: n("grossProfit") / n("grossLoss") };
      break;
    case "drawdown": {
      const peak = n("peak");
      const trough = n("trough");
      if (trough > peak) return { ok: false, issues: [{ code: "troughAbovePeak", field: "trough" }] };
      const drawdown = (peak - trough) / peak;
      values = {
        drawdownPercent: drawdown * 100,
        recoveryPercent: trough === 0 ? Number.POSITIVE_INFINITY : ((peak - trough) / trough) * 100,
      };
      break;
    }
    case "break-even-win-rate":
      values = {
        breakEvenWinRate:
          (n("averageLoss") / (n("averageWin") + n("averageLoss"))) * 100,
      };
      break;
    case "leverage-margin":
      values = {
        leverage: n("exposure") / n("equity"),
        marginPercent: (n("equity") / n("exposure")) * 100,
      };
      break;
    case "compound-interest":
      values = {
        futureValue:
          n("principal") *
          (1 + n("annualRate") / 100 / n("compounds")) **
            (n("compounds") * n("years")),
      };
      break;
    case "present-value":
      values = {
        presentValue: n("futureValue") / (1 + n("rate") / 100) ** n("periods"),
      };
      break;
    case "future-value": {
      const rate = n("rate") / 100;
      const periods = n("periods");
      const contributionFactor = rate === 0 ? periods : ((1 + rate) ** periods - 1) / rate;
      values = {
        futureValue:
          n("presentValue") * (1 + rate) ** periods + n("payment") * contributionFactor,
      };
      break;
    }
    case "npv": {
      const rate = n("discountRate") / 100;
      const years = n("years");
      const discountedFlows = Array.from(
        { length: years },
        (_, index) => n("annualCashFlow") / (1 + rate) ** (index + 1),
      );
      values = {
        npv: stableSum([
          -n("initialInvestment"),
          ...discountedFlows,
          n("terminalValue") / (1 + rate) ** years,
        ]),
      };
      break;
    }
    case "irr": {
      const solution = solveIrr(seriesAt(inputs, "cashFlows"));
      if (!solution.ok) return { ok: false, issues: [{ code: solution.code, field: "cashFlows" }] };
      values = { irrPercent: solution.rate * 100 };
      break;
    }
    case "bond-price": {
      const periods = n("years") * n("frequency");
      const periodicYield = n("yieldRate") / 100 / n("frequency");
      const coupon = (n("faceValue") * (n("couponRate") / 100)) / n("frequency");
      const coupons = Array.from(
        { length: periods },
        (_, index) => coupon / (1 + periodicYield) ** (index + 1),
      );
      values = {
        bondPrice: stableSum([
          ...coupons,
          n("faceValue") / (1 + periodicYield) ** periods,
        ]),
      };
      break;
    }
    case "yield":
      values = {
        currentYield:
          ((n("faceValue") * (n("couponRate") / 100)) / n("marketPrice")) * 100,
      };
      break;
    case "capm":
      values = {
        expectedReturn:
          n("riskFreeRate") + n("beta") * (n("marketReturn") - n("riskFreeRate")),
      };
      break;
    case "wacc": {
      const totalCapital = n("equityValue") + n("debtValue");
      if (totalCapital <= 0) {
        return { ok: false, issues: [{ code: "exclusiveMinimum", field: "equityValue", limit: 0 }] };
      }
      values = {
        wacc:
          (n("equityValue") / totalCapital) * n("costEquity") +
          (n("debtValue") / totalCapital) * n("costDebt") * (1 - n("taxRate") / 100),
      };
      break;
    }
    case "basic-dcf": {
      const discountRate = n("discountRate") / 100;
      const terminalGrowth = n("terminalGrowth") / 100;
      if (discountRate <= terminalGrowth) {
        return { ok: false, issues: [{ code: "discountAboveGrowth", field: "discountRate" }] };
      }
      const growthRate = n("growthRate") / 100;
      const years = n("years");
      const projected = Array.from(
        { length: years },
        (_, index) => n("currentFcf") * (1 + growthRate) ** (index + 1),
      );
      const discounted = projected.map(
        (cashFlow, index) => cashFlow / (1 + discountRate) ** (index + 1),
      );
      const terminalValue =
        (projected.at(-1)! * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
      values = {
        enterpriseValue: stableSum([
          ...discounted,
          terminalValue / (1 + discountRate) ** years,
        ]),
      };
      break;
    }
  }
  if (Object.values(values).some((value) => !Number.isFinite(value))) {
    return { ok: false, issues: [{ code: "nonFiniteResult" }] };
  }
  return { ok: true, values };
}

export function calculateTool(
  id: CalculatorId,
  rawInputs: Record<string, string>,
): CalculationOutcome {
  const definition = getCalculator(id);
  const parsed = parseInputs(definition, rawInputs);
  if (!parsed.ok) return parsed;
  if (!("parsed" in parsed)) return parsed;
  return evaluate(id, parsed.parsed);
}
