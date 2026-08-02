import type {
  AcademyModule,
  DemoCandle,
  DemoLesson,
  DemoScenario,
  GlossaryDefinition,
  LearningPathSummary,
  QuizQuestion,
  ReviewCardDefinition,
} from "./academy-types";

export const DEMO_PATHS: LearningPathSummary[] = [
  {
    id: "path-finance-foundations",
    title: { de: "Finanzgrundlagen", sl: "Osnove financ", en: "Finance Foundations" },
    summary: {
      de: "Verstehe Risiko, Rendite, Zinsen, Inflation und die wichtigsten Finanzinstrumente.",
      sl: "Razumi tveganje, donos, obresti, inflacijo in ključne finančne instrumente.",
      en: "Understand risk, return, interest, inflation, and the essential financial instruments.",
    },
    difficulty: "beginner",
    estimatedMinutes: 360,
    lessonCount: 8,
    status: "active",
    previewTopics: {
      de: ["Finanzlandkarte", "Risiko und Rendite", "Zinseszins", "Aktien, Anleihen und ETFs"],
      sl: ["Zemljevid financ", "Tveganje in donos", "Obrestno obrestovanje", "Delnice, obveznice in ETF-i"],
      en: ["Finance map", "Risk and return", "Compound interest", "Stocks, bonds, and ETFs"],
    },
  },
  {
    id: "path-trading-foundations",
    title: { de: "Tradinggrundlagen", sl: "Osnove trgovanja", en: "Trading Foundations" },
    summary: {
      de: "Lerne Ordertypen, Spread, Liquidität, Sessions, Kosten und verantwortungsvolle Ausführung.",
      sl: "Spoznaj naročila, razmik, likvidnost, trgovalne ure, stroške in odgovorno izvedbo.",
      en: "Learn orders, spread, liquidity, sessions, costs, and responsible execution.",
    },
    difficulty: "beginner",
    estimatedMinutes: 420,
    lessonCount: 8,
    status: "active",
    previewTopics: {
      de: ["Bid und Ask", "Ordertypen", "Liquidität", "Long und Short"],
      sl: ["Nakupna in prodajna cena", "Vrste naročil", "Likvidnost", "Dolge in kratke pozicije"],
      en: ["Bid and ask", "Order types", "Liquidity", "Long and short"],
    },
  },
  {
    id: "path-risk-management",
    title: { de: "Risikomanagement", sl: "Upravljanje tveganj", en: "Risk Management" },
    summary: {
      de: "Baue Positionsgröße, Verlustgrenzen, Erwartungswert und einen belastbaren Risikoplan auf.",
      sl: "Zgradi sistem velikosti pozicije, omejitev izgub, pričakovane vrednosti in načrta tveganja.",
      en: "Build position sizing, loss limits, expectancy, and a durable risk plan.",
    },
    difficulty: "intermediate",
    estimatedMinutes: 480,
    lessonCount: 8,
    status: "active",
    previewTopics: {
      de: ["Risiko pro Trade", "R-Multiples", "Drawdown", "Risk of Ruin"],
      sl: ["Tveganje na posel", "R-količniki", "Padec vrednosti", "Tveganje propada"],
      en: ["Risk per trade", "R multiples", "Drawdown", "Risk of ruin"],
    },
  },
  {
    id: "path-technical-analysis",
    title: { de: "Technische Analyse", sl: "Tehnična analiza", en: "Technical Analysis" },
    summary: {
      de: "Lies Marktstruktur, Trends, Volumen und Indikatoren ohne garantierte Prognosen.",
      sl: "Beri tržno strukturo, trende, volumen in kazalnike brez obljub o napovedih.",
      en: "Read market structure, trends, volume, and indicators without guaranteed predictions.",
    },
    difficulty: "intermediate",
    estimatedMinutes: 450,
    lessonCount: 8,
    status: "active",
    previewTopics: {
      de: ["Kerzen", "Trends", "Support und Resistance", "VWAP und ATR"],
      sl: ["Sveče", "Trendi", "Podpora in odpor", "VWAP in ATR"],
      en: ["Candles", "Trends", "Support and resistance", "VWAP and ATR"],
    },
  },
];

export const DEMO_MODULES: AcademyModule[] = [
  ["module-ff-map", "Die Finanzlandkarte", "Zemljevid financ", "The finance map"],
  ["module-ff-risk", "Risiko und Rendite", "Tveganje in donos", "Risk and return"],
  ["module-ff-time", "Geld und Zeit", "Denar in čas", "Money and time"],
  ["module-ff-markets", "Finanzmärkte", "Finančni trgi", "Financial markets"],
  ["module-ff-assets", "Instrumente", "Instrumenti", "Instruments"],
  ["module-ff-process", "Dein Finanzprozess", "Tvoj finančni proces", "Your finance process"],
].map(([id, de, sl, en], index) => ({
  id,
  pathId: "path-finance-foundations",
  order: index + 1,
  title: { de, sl, en },
  summary: {
    de: index === 0 ? "Ordne Haushalte, Unternehmen, Staaten und Märkte in einem zusammenhängenden System ein." : "Ein strukturierter Baustein für belastbare Finanzentscheidungen.",
    sl: index === 0 ? "Poveži gospodinjstva, podjetja, države in trge v enoten sistem." : "Strukturiran gradnik za premišljene finančne odločitve.",
    en: index === 0 ? "Connect households, companies, governments, and markets in one coherent system." : "A structured building block for durable financial decisions.",
  },
  lessonIds: index === 0 ? ["lesson-ff-finance-map"] : [],
}));

export const DEMO_LESSON: DemoLesson = {
  id: "lesson-ff-finance-map",
  pathId: "path-finance-foundations",
  moduleId: "module-ff-map",
  title: { de: "Die Landkarte der Finanzwelt", sl: "Zemljevid finančnega sveta", en: "A map of the financial world" },
  summary: {
    de: "Verstehe, wie Kapital zwischen Sparern, Unternehmen, Staaten und Märkten fließt.",
    sl: "Razumi, kako kapital teče med varčevalci, podjetji, državami in trgi.",
    en: "Understand how capital moves among savers, companies, governments, and markets.",
  },
  durationMinutes: 18,
  objectives: {
    de: ["Finanzen als System von Entscheidungen erklären", "Primär- und Sekundärmärkte unterscheiden", "Risiko, Zeit und Information als Kernfaktoren erkennen"],
    sl: ["Pojasniti finance kot sistem odločitev", "Ločiti primarne in sekundarne trge", "Prepoznati tveganje, čas in informacije kot ključne dejavnike"],
    en: ["Explain finance as a system of decisions", "Distinguish primary and secondary markets", "Recognise risk, time, and information as core forces"],
  },
  sections: {
    core: {
      de: "Finanzen beschreiben, wie Menschen und Institutionen Geld über die Zeit verteilen, Risiken tragen und Informationen in Entscheidungen übersetzen. Ein Haushalt spart, ein Unternehmen finanziert eine Investition, ein Staat begibt eine Anleihe und ein Markt bringt diese Interessen zusammen. Die Börse ist deshalb nicht das ganze Finanzsystem, sondern eine Infrastruktur innerhalb dieses Systems.",
      sl: "Finance opisujejo, kako ljudje in institucije razporejajo denar skozi čas, prevzemajo tveganja in informacije pretvarjajo v odločitve. Gospodinjstvo varčuje, podjetje financira naložbo, država izda obveznico, trg pa te interese poveže. Borza zato ni celoten finančni sistem, temveč infrastruktura znotraj njega.",
      en: "Finance describes how people and institutions allocate money through time, bear risk, and turn information into decisions. A household saves, a company finances an investment, a government issues a bond, and a market connects those interests. An exchange is therefore not the whole financial system; it is infrastructure inside that system.",
    },
    visual: {
      de: "Stelle dir zwei Ebenen vor: Im Primärmarkt erhält ein Emittent neues Kapital. Im Sekundärmarkt handeln Anleger bereits ausgegebene Instrumente miteinander. Der zweite Handel finanziert das Unternehmen nicht erneut, verbessert aber Liquidität und Preisfindung.",
      sl: "Predstavljaj si dve ravni: na primarnem trgu izdajatelj prejme nov kapital. Na sekundarnem trgu vlagatelji med seboj trgujejo z že izdanimi instrumenti. Drugo trgovanje podjetja ne financira ponovno, izboljša pa likvidnost in oblikovanje cen.",
      en: "Picture two layers: in the primary market, an issuer receives new capital. In the secondary market, investors trade existing instruments with one another. The second trade does not fund the company again, but it improves liquidity and price discovery.",
    },
    exercise: {
      de: "Eine Stadt begibt eine neue Anleihe; zwei Wochen später verkauft ein Fonds diese Anleihe an eine Bank. Ordne beide Vorgänge dem richtigen Markt zu und erkläre, wer Geld erhält.",
      sl: "Mesto izda novo obveznico; dva tedna pozneje sklad obveznico proda banki. Razvrsti oba dogodka na pravi trg in pojasni, kdo prejme denar.",
      en: "A city issues a new bond; two weeks later a fund sells that bond to a bank. Classify both events and explain who receives the money.",
    },
    worked: {
      de: "Bei der Emission erhält die Stadt im Primärmarkt das Kapital. Beim späteren Verkauf erhält der Fonds im Sekundärmarkt den Kaufpreis. Die Stadt ist an diesem zweiten Tausch nicht direkt beteiligt.",
      sl: "Ob izdaji mesto prejme kapital na primarnem trgu. Pri poznejši prodaji sklad prejme kupnino na sekundarnem trgu. Mesto pri tej drugi menjavi ne sodeluje neposredno.",
      en: "At issuance, the city receives capital in the primary market. In the later sale, the fund receives the purchase price in the secondary market. The city is not directly involved in that second exchange.",
    },
    mistake: {
      de: "Ein steigender Börsenkurs bedeutet nicht, dass bei jedem Trade neues Geld in das Unternehmen fließt. Meist wechseln bestehende Anteile nur den Besitzer.",
      sl: "Rast borzne cene ne pomeni, da ob vsaki transakciji v podjetje priteče nov denar. Navadno obstoječi deleži le zamenjajo lastnika.",
      en: "A rising market price does not mean each trade sends new money to the company. Existing ownership claims usually just change hands.",
    },
    takeaway: {
      de: "Frage bei jedem Finanzvorgang: Wer stellt Kapital bereit, wer erhält es, welches Risiko wird übertragen und auf welchem Markt geschieht das?",
      sl: "Pri vsakem finančnem dogodku vprašaj: kdo zagotovi kapital, kdo ga prejme, katero tveganje se prenese in na katerem trgu se to zgodi?",
      en: "For every financial event ask: who supplies capital, who receives it, what risk is transferred, and in which market does it happen?",
    },
  },
  glossaryIds: ["term-primary-market", "term-secondary-market", "term-liquidity"],
  sourceIds: ["European Central Bank — Financial markets", "Investor.gov — How stock markets work"],
  knowledgeCheckIds: ["q-ff-finance-map-1", "q-ff-finance-map-2", "q-ff-finance-map-3"],
};

export const DEMO_QUIZ: QuizQuestion[] = [
  {
    id: "q-ff-finance-map-1",
    prompt: { de: "Wer erhält Kapital bei einer neuen Aktienemission?", sl: "Kdo prejme kapital ob novi izdaji delnic?", en: "Who receives capital in a new share issuance?" },
    options: [
      { id: "issuer", label: { de: "Das emittierende Unternehmen", sl: "Podjetje izdajatelj", en: "The issuing company" } },
      { id: "exchange", label: { de: "Die Börse", sl: "Borza", en: "The exchange" } },
      { id: "seller", label: { de: "Ein späterer Verkäufer", sl: "Poznejši prodajalec", en: "A later seller" } },
    ],
    correctOptionId: "issuer",
    explanation: { de: "Im Primärmarkt fließt das Kapital an den Emittenten.", sl: "Na primarnem trgu kapital prejme izdajatelj.", en: "In the primary market, capital flows to the issuer." },
    alternatives: { de: "Die Börse organisiert Handel; ein späterer Verkäufer handelt im Sekundärmarkt.", sl: "Borza organizira trgovanje; poznejši prodajalec deluje na sekundarnem trgu.", en: "The exchange organises trading; a later seller trades in the secondary market." },
  },
  {
    id: "q-ff-finance-map-2",
    prompt: { de: "Welche Funktion erfüllt ein liquider Sekundärmarkt?", sl: "Kaj omogoča likviden sekundarni trg?", en: "What does a liquid secondary market provide?" },
    options: [
      { id: "guarantee", label: { de: "Garantierte Gewinne", sl: "Zagotovljen dobiček", en: "Guaranteed profits" } },
      { id: "transfer", label: { de: "Einfacheren Risikotransfer und Preisfindung", sl: "Lažji prenos tveganja in oblikovanje cen", en: "Easier risk transfer and price discovery" } },
      { id: "free", label: { de: "Kostenlosen Handel", sl: "Brezplačno trgovanje", en: "Free trading" } },
    ],
    correctOptionId: "transfer",
    explanation: { de: "Liquidität erleichtert Transaktionen und unterstützt Preisfindung, garantiert aber kein Ergebnis.", sl: "Likvidnost olajša transakcije in oblikovanje cen, ne zagotavlja pa rezultata.", en: "Liquidity makes transactions easier and supports price discovery, but guarantees no outcome." },
    alternatives: { de: "Gewinne und Kosten hängen von Risiko, Preis, Gebühren und Ausführung ab.", sl: "Dobiček in stroški so odvisni od tveganja, cene, provizij in izvedbe.", en: "Profit and cost depend on risk, price, fees, and execution." },
  },
  {
    id: "q-ff-finance-map-3",
    prompt: { de: "Was geschieht meist, wenn eine bestehende Aktie an der Börse verkauft wird?", sl: "Kaj se navadno zgodi, ko se obstoječa delnica proda na borzi?", en: "What usually happens when an existing share is sold on an exchange?" },
    options: [
      { id: "ownership", label: { de: "Der Eigentumsanspruch wechselt den Besitzer", sl: "Lastniški delež zamenja lastnika", en: "The ownership claim changes hands" } },
      { id: "newcapital", label: { de: "Das Unternehmen erhält immer neues Kapital", sl: "Podjetje vedno prejme nov kapital", en: "The company always receives new capital" } },
      { id: "debt", label: { de: "Die Aktie wird automatisch zur Anleihe", sl: "Delnica samodejno postane obveznica", en: "The share automatically becomes a bond" } },
    ],
    correctOptionId: "ownership",
    explanation: { de: "Sekundärmarkttransaktionen übertragen bestehende Ansprüche zwischen Anlegern.", sl: "Posli na sekundarnem trgu prenašajo obstoječe pravice med vlagatelji.", en: "Secondary-market transactions transfer existing claims between investors." },
    alternatives: { de: "Neue Unternehmensfinanzierung geschieht bei Emissionen; Aktien und Anleihen bleiben verschiedene Instrumente.", sl: "Novo financiranje podjetja nastane ob izdaji; delnice in obveznice ostanejo različni instrumenti.", en: "New company financing occurs at issuance; shares and bonds remain different instruments." },
  },
];

export const DEMO_REVIEW_CARDS: ReviewCardDefinition[] = [
  { id: "card-primary", front: { de: "Primärmarkt", sl: "Primarni trg", en: "Primary market" }, back: { de: "Markt, auf dem neue Instrumente ausgegeben werden und Kapital an den Emittenten fließt.", sl: "Trg, kjer se izdajo novi instrumenti in kapital prejme izdajatelj.", en: "The market where new instruments are issued and capital flows to the issuer." } },
  { id: "card-secondary", front: { de: "Sekundärmarkt", sl: "Sekundarni trg", en: "Secondary market" }, back: { de: "Markt, auf dem bestehende Instrumente zwischen Anlegern gehandelt werden.", sl: "Trg, kjer vlagatelji trgujejo z že izdanimi instrumenti.", en: "The market where existing instruments trade among investors." } },
  { id: "card-liquidity", front: { de: "Liquidität", sl: "Likvidnost", en: "Liquidity" }, back: { de: "Wie leicht ein Instrument ohne große Preiswirkung gehandelt werden kann.", sl: "Kako zlahka je mogoče trgovati z instrumentom brez velikega vpliva na ceno.", en: "How easily an instrument can trade without a large price impact." } },
  { id: "card-risk", front: { de: "Risiko", sl: "Tveganje", en: "Risk" }, back: { de: "Unsicherheit über mögliche Ergebnisse, nicht nur die Wahrscheinlichkeit eines Verlusts.", sl: "Negotovost glede možnih izidov, ne le verjetnost izgube.", en: "Uncertainty about possible outcomes, not merely the chance of loss." } },
];

export const DEMO_GLOSSARY: GlossaryDefinition[] = [
  { id: "term-primary-market", term: { de: "Primärmarkt", sl: "Primarni trg", en: "Primary market" }, definition: DEMO_REVIEW_CARDS[0].back },
  { id: "term-secondary-market", term: { de: "Sekundärmarkt", sl: "Sekundarni trg", en: "Secondary market" }, definition: DEMO_REVIEW_CARDS[1].back },
  { id: "term-liquidity", term: { de: "Liquidität", sl: "Likvidnost", en: "Liquidity" }, definition: DEMO_REVIEW_CARDS[2].back },
  { id: "term-spread", term: { de: "Spread", sl: "Razmik", en: "Spread" }, definition: { de: "Differenz zwischen bestem Kauf- und Verkaufspreis.", sl: "Razlika med najboljšo nakupno in prodajno ceno.", en: "The difference between the best bid and ask prices." } },
  { id: "term-r-multiple", term: { de: "R-Multiple", sl: "R-količnik", en: "R multiple" }, definition: { de: "Ergebnis eines Trades relativ zum vorher geplanten Risiko.", sl: "Rezultat posla glede na vnaprej načrtovano tveganje.", en: "A trade result measured against its pre-planned risk." } },
  { id: "term-drawdown", term: { de: "Drawdown", sl: "Padec vrednosti", en: "Drawdown" }, definition: { de: "Rückgang vom bisherigen Kapitalhoch zum folgenden Tief.", sl: "Padec od prejšnjega vrha kapitala do naslednjega dna.", en: "The decline from an equity peak to a subsequent trough." } },
];

function createCandles(): DemoCandle[] {
  const candles: DemoCandle[] = [];
  let previous = 100;
  const start = 1_735_689_600;
  for (let index = 0; index < 48; index += 1) {
    const drift = index < 34 ? 0.34 : index < 41 ? -0.15 : 0.22;
    const wave = Math.sin(index * 0.83) * 0.42;
    const open = previous;
    const close = open + drift + wave;
    candles.push({
      time: start + index * 3600,
      open: Number(open.toFixed(2)),
      high: Number((Math.max(open, close) + 0.45 + (index % 3) * 0.08).toFixed(2)),
      low: Number((Math.min(open, close) - 0.4 - (index % 2) * 0.1).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 900 + ((index * 173) % 1100),
    });
    previous = close;
  }
  return candles;
}

export const DEMO_CANDLES = createCandles();

export const DEMO_SCENARIO: DemoScenario = {
  id: "scenario-trend-continuation",
  title: { de: "Trendfortsetzung mit Rücksetzer", sl: "Nadaljevanje trenda po popravku", en: "Trend continuation after a pullback" },
  context: {
    de: "Ein liquides, simuliertes Instrument handelt über einem steigenden Durchschnitt. Bewerte Risiko und Prozess, nicht nur das Ergebnis.",
    sl: "Likviden simuliran instrument se trguje nad rastočim povprečjem. Ocenjuj tveganje in proces, ne le rezultata.",
    en: "A liquid simulated instrument trades above a rising average. Judge risk and process, not only the outcome.",
  },
  goal: {
    de: "Plane höchstens 1 % Risiko, setze einen logischen Stop und vermeide einen Einstieg nach einer überdehnten Kerze.",
    sl: "Načrtuj največ 1 % tveganja, postavi smiseln stop in se izogni vstopu po pretirano raztegnjeni sveči.",
    en: "Plan no more than 1% risk, place a logical stop, and avoid entering after an overextended candle.",
  },
  candles: DEMO_CANDLES,
  initialVisibleCandles: 24,
};
