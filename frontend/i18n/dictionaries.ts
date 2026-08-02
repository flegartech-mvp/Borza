export const SUPPORTED_LANGUAGES = ["de", "sl", "en"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type AcademyDictionary = {
  languageName: string;
  brand: { name: string; tagline: string; promise: string };
  common: {
    start: string;
    trySimulator: string;
    continue: string;
    save: string;
    cancel: string;
    next: string;
    previous: string;
    complete: string;
    loading: string;
    retry: string;
    demo: string;
    localDemo: string;
    configuredRequired: string;
    more: string;
    comingNext: string;
  };
  nav: Record<
    | "home"
    | "learn"
    | "practice"
    | "simulator"
    | "tools"
    | "review"
    | "journal"
    | "profile"
    | "glossary"
    | "progress"
    | "achievements"
    | "settings",
    string
  >;
  landing: {
    eyebrow: string;
    title: string;
    body: string;
    lessonPreview: string;
    chartPreview: string;
    riskTitle: string;
    riskBody: string;
    multilingual: string;
    multilingualBody: string;
    toolsTitle: string;
    toolsBody: string;
    pathsTitle: string;
    pathsBody: string;
    responsible: string;
  };
  auth: {
    signIn: string;
    register: string;
    forgot: string;
    email: string;
    password: string;
    fullName: string;
    signOut: string;
    noAccount: string;
    hasAccount: string;
    resetIntro: string;
    resetSent: string;
    submit: string;
    configurationTitle: string;
    configurationBody: string;
    error: string;
  };
  onboarding: {
    title: string;
    intro: string;
    goal: string;
    level: string;
    interest: string;
    weekly: string;
    experience: string;
    risk: string;
    style: string;
    placement: string;
    placementQuestion: string;
    recommendation: string;
    finish: string;
  };
  dashboard: {
    welcome: string;
    level: string;
    continueLearning: string;
    reviewsDue: string;
    weeklyProgress: string;
    mastery: string;
    streak: string;
    simulator: string;
    journal: string;
    nextLesson: string;
    weakConcepts: string;
  };
  learn: {
    title: string;
    intro: string;
    activePaths: string;
    skillMap: string;
    available: string;
    current: string;
    locked: string;
    mastered: string;
    lessons: string;
    minutes: string;
    openPath: string;
    objectives: string;
    prerequisites: string;
    modules: string;
  };
  lesson: {
    objectives: string;
    core: string;
    visual: string;
    exercise: string;
    worked: string;
    mistake: string;
    takeaway: string;
    check: string;
    cards: string;
    sources: string;
    notes: string;
    bookmark: string;
    curriculum: string;
    glossary: string;
    progress: string;
    markComplete: string;
  };
  quiz: {
    title: string;
    submit: string;
    correct: string;
    incorrect: string;
    explanation: string;
    alternatives: string;
    result: string;
    reviewConcept: string;
  };
  review: {
    title: string;
    intro: string;
    due: string;
    reveal: string;
    again: string;
    hard: string;
    good: string;
    easy: string;
    complete: string;
    nextDue: string;
  };
  practice: {
    title: string;
    intro: string;
    prompt: string;
    uptrend: string;
    downtrend: string;
    range: string;
    check: string;
    replay: string;
    simulated: string;
    attribution: string;
  };
  simulator: {
    title: string;
    intro: string;
    warning: string;
    balance: string;
    equity: string;
    play: string;
    pause: string;
    step: string;
    speed: string;
    long: string;
    short: string;
    orderType: string;
    market: string;
    limit: string;
    stop: string;
    bracket: string;
    size: string;
    risk: string;
    spread: string;
    commission: string;
    slippage: string;
    place: string;
    close: string;
    positions: string;
    pending: string;
    history: string;
    analytics: string;
    processScore: string;
    results: string;
  };
  tools: {
    title: string;
    intro: string;
    calculate: string;
    formula: string;
    example: string;
    interpretation: string;
    mistake: string;
    related: string;
    result: string;
    invalid: string;
  };
  journal: {
    title: string;
    intro: string;
    setup: string;
    thesis: string;
    context: string;
    entry: string;
    stop: string;
    target: string;
    plannedRisk: string;
    result: string;
    emotionBefore: string;
    emotionAfter: string;
    adherence: string;
    lesson: string;
    tags: string;
    add: string;
    saved: string;
    repeated: string;
    patterns: string;
  };
  secondary: {
    glossaryTitle: string;
    glossaryIntro: string;
    progressTitle: string;
    progressIntro: string;
    achievementsTitle: string;
    achievementsIntro: string;
    settingsTitle: string;
    settingsIntro: string;
    profileTitle: string;
    profileIntro: string;
  };
};

const de: AcademyDictionary = {
  languageName: "Deutsch",
  brand: {
    name: "Borza Academy",
    tagline: "Finanzwissen, das in Entscheidungen mündet",
    promise: "Finanzen verstehen. Trading üben. Marktfähigkeiten aufbauen.",
  },
  common: {
    start: "Lernen starten",
    trySimulator: "Simulator testen",
    continue: "Weiter",
    save: "Speichern",
    cancel: "Abbrechen",
    next: "Weiter",
    previous: "Zurück",
    complete: "Abgeschlossen",
    loading: "Wird geladen…",
    retry: "Erneut versuchen",
    demo: "Demo",
    localDemo: "Lokale Browser-Demo",
    configuredRequired: "Konto-Konfiguration erforderlich",
    more: "Mehr",
    comingNext: "Als Nächstes",
  },
  nav: {
    home: "Home",
    learn: "Lernen",
    practice: "Üben",
    simulator: "Simulator",
    tools: "Finanztools",
    review: "Wiederholen",
    journal: "Journal",
    profile: "Profil",
    glossary: "Glossar",
    progress: "Fortschritt",
    achievements: "Erfolge",
    settings: "Einstellungen",
  },
  landing: {
    eyebrow: "Interaktive Finanzbildung",
    title: "Finanzen verstehen. Trading üben. Marktfähigkeiten aufbauen.",
    body: "Ein ruhiger, strukturierter Lernraum für Finanzgrundlagen, Marktmechanik, Risikomanagement und verantwortungsvolles Tradingtraining.",
    lessonPreview: "Eine echte Lektion, nicht nur ein Kurskatalog",
    chartPreview: "Charts lesen, bevor du Entscheidungen bewertest",
    riskTitle: "Risiko vor Rendite",
    riskBody:
      "Positionsgröße, Verlustgrenzen und Prozessqualität stehen vor Ergebnisdenken.",
    multilingual: "Deutsch, Slovenščina und English",
    multilingualBody:
      "Die Kernanwendung und die Demo-Lektion sind in allen drei Sprachen nutzbar.",
    toolsTitle: "Werkzeuge mit Erklärung",
    toolsBody:
      "18 Rechner verbinden Formel, Beispiel, Interpretation und typische Fehler.",
    pathsTitle: "Vier vollständige Startpfade",
    pathsBody:
      "Finanzgrundlagen, Tradinggrundlagen, Risikomanagement und Technische Analyse.",
    responsible:
      "Nur Bildung und Simulation. Keine Anlageberatung, keine Live-Orders und keine Gewinnversprechen.",
  },
  auth: {
    signIn: "Anmelden",
    register: "Konto erstellen",
    forgot: "Passwort vergessen",
    email: "E-Mail",
    password: "Passwort",
    fullName: "Name",
    signOut: "Abmelden",
    noAccount: "Noch kein Konto?",
    hasAccount: "Bereits registriert?",
    resetIntro: "Wir senden dir einen sicheren Link zum Zurücksetzen.",
    resetSent: "Prüfe dein Postfach. Der Link wurde angefordert.",
    submit: "Sicher fortfahren",
    configurationTitle: "Supabase Auth ist noch nicht konfiguriert",
    configurationBody:
      "Die öffentliche Demo bleibt verfügbar. Für Konten müssen die öffentliche URL und der Publishable Key gesetzt sein.",
    error: "Die Anfrage konnte nicht abgeschlossen werden.",
  },
  onboarding: {
    title: "Dein Lernplan",
    intro:
      "Acht kurze Antworten genügen für eine sinnvolle Empfehlung. Wir fragen nie nach Kontoständen.",
    goal: "Lernziel",
    level: "Erfahrungsniveau",
    interest: "Finanzen oder Trading",
    weekly: "Wöchentliche Lernzeit",
    experience: "Bisherige Markterfahrung",
    risk: "Risikowissen",
    style: "Bevorzugter Lernstil",
    placement: "Optionaler Einstufungstest",
    placementQuestion:
      "Was schützt ein Konto am direktesten vor einem einzelnen großen Verlust?",
    recommendation: "Empfohlener Start",
    finish: "Plan speichern und starten",
  },
  dashboard: {
    welcome: "Willkommen zurück",
    level: "Aktuelles Niveau",
    continueLearning: "Weiterlernen",
    reviewsDue: "Heute fällige Karten",
    weeklyProgress: "Wochenfortschritt",
    mastery: "Kompetenzstand",
    streak: "Lernserie",
    simulator: "Simulator-Zusammenfassung",
    journal: "Letzte Journalnotizen",
    nextLesson: "Nächste empfohlene Lektion",
    weakConcepts: "Jetzt wiederholen",
  },
  learn: {
    title: "Lernpfade",
    intro:
      "Baue Fähigkeiten in einer klaren Reihenfolge auf und sieh, was als Nächstes freigeschaltet wird.",
    activePaths: "Aktive Lernpfade",
    skillMap: "Skill Map",
    available: "Verfügbar",
    current: "Aktuell",
    locked: "Voraussetzung fehlt",
    mastered: "Gemeistert",
    lessons: "Lektionen",
    minutes: "Minuten",
    openPath: "Pfad öffnen",
    objectives: "Lernziele",
    prerequisites: "Voraussetzungen",
    modules: "Module",
  },
  lesson: {
    objectives: "Das lernst du",
    core: "Kernerklärung",
    visual: "Visuelles Beispiel",
    exercise: "Interaktive Übung",
    worked: "Durchgerechnetes Beispiel",
    mistake: "Häufiger Fehler",
    takeaway: "Praktischer Merksatz",
    check: "Wissenscheck",
    cards: "Wiederholungskarten",
    sources: "Quellen und Weiterlesen",
    notes: "Notizen",
    bookmark: "Lesezeichen",
    curriculum: "Lektionsübersicht",
    glossary: "Begriffe",
    progress: "Lektionsfortschritt",
    markComplete: "Lektion abschließen",
  },
  quiz: {
    title: "Wissenscheck",
    submit: "Antwort prüfen",
    correct: "Richtig",
    incorrect: "Noch nicht",
    explanation: "Warum",
    alternatives: "Warum die Alternativen nicht passen",
    result: "Ergebnis",
    reviewConcept: "Zur Wiederholung vormerken",
  },
  review: {
    title: "Tägliche Wiederholung",
    intro: "FSRS plant jede Karte anhand deiner tatsächlichen Erinnerung neu.",
    due: "Heute fällig",
    reveal: "Antwort zeigen",
    again: "Nochmal",
    hard: "Schwer",
    good: "Gut",
    easy: "Leicht",
    complete: "Wiederholung abgeschlossen",
    nextDue: "Nächste Fälligkeit",
  },
  practice: {
    title: "Chart-Labor",
    intro:
      "Trainiere Beobachtung und Risikodenken mit deterministischen, simulierten Kerzen.",
    prompt: "Welche Marktstruktur ist sichtbar?",
    uptrend: "Aufwärtstrend",
    downtrend: "Abwärtstrend",
    range: "Seitwärtsphase",
    check: "Einordnung prüfen",
    replay: "Nächste Kerze",
    simulated: "Deterministische Simulationsdaten – keine Live-Marktdaten",
    attribution: "Charts powered by TradingView Lightweight Charts™",
  },
  simulator: {
    title: "Lern-Simulator",
    intro:
      "Übe Ausführung, Risiko und Disziplin in einer reproduzierbaren historischen Simulation.",
    warning: "Nur Paper Trading. Es werden keine echten Aufträge übertragen.",
    balance: "Startguthaben",
    equity: "Kontowert",
    play: "Abspielen",
    pause: "Pause",
    step: "Schritt",
    speed: "Tempo",
    long: "Long",
    short: "Short",
    orderType: "Ordertyp",
    market: "Market",
    limit: "Limit",
    stop: "Stop",
    bracket: "Bracket",
    size: "Positionsgröße",
    risk: "Risiko pro Trade",
    spread: "Spread",
    commission: "Kommission",
    slippage: "Slippage",
    place: "Simulierte Order platzieren",
    close: "Position schließen",
    positions: "Offene Positionen",
    pending: "Offene Orders",
    history: "Trade-Verlauf",
    analytics: "Prozess-Analytics",
    processScore: "Prozessqualität",
    results: "Szenario auswerten",
  },
  tools: {
    title: "Finanztools",
    intro:
      "Rechner, die nicht nur eine Zahl liefern, sondern die Entscheidung dahinter erklären.",
    calculate: "Berechnen",
    formula: "Formel",
    example: "Beispiel",
    interpretation: "Interpretation",
    mistake: "Typischer Fehler",
    related: "Passende Lektion",
    result: "Ergebnis",
    invalid: "Bitte alle Eingaben als gültige Zahlen prüfen.",
  },
  journal: {
    title: "Trading-Journal",
    intro:
      "Dokumentiere Plan, Emotionen und Regelbefolgung – nicht nur Gewinn oder Verlust.",
    setup: "Setup",
    thesis: "These",
    context: "Marktkontext",
    entry: "Einstieg",
    stop: "Stop",
    target: "Ziel",
    plannedRisk: "Geplantes Risiko",
    result: "Ergebnis in R",
    emotionBefore: "Emotion vor Einstieg",
    emotionAfter: "Emotion nach Ausstieg",
    adherence: "Regeln befolgt",
    lesson: "Gelernte Lektion",
    tags: "Tags",
    add: "Eintrag speichern",
    saved: "Gespeicherte Einträge",
    repeated: "Wiederholte Fehler",
    patterns: "Emotionale Muster",
  },
  secondary: {
    glossaryTitle: "Finanzglossar",
    glossaryIntro: "Klare Definitionen mit praktischem Kontext.",
    progressTitle: "Fortschritt und Mastery",
    progressIntro: "Mehrere Evidenzarten zeigen, was du wirklich beherrschst.",
    achievementsTitle: "Erfolge",
    achievementsIntro:
      "Belohnungen für Disziplin, Übung und ehrliche Reflexion.",
    settingsTitle: "Einstellungen",
    settingsIntro: "Sprache, Darstellung und Lernpräferenzen.",
    profileTitle: "Profil",
    profileIntro: "Dein Lernziel, Niveau und Wochenplan an einem Ort.",
  },
};

const sl: AcademyDictionary = {
  ...de,
  languageName: "Slovenščina",
  brand: {
    name: "Borza Academy",
    tagline: "Finančno znanje za boljše odločitve",
    promise: "Razumi finance. Vadi trgovanje. Zgradi resnične tržne veščine.",
  },
  common: {
    ...de.common,
    start: "Začni z učenjem",
    trySimulator: "Preizkusi simulator",
    continue: "Nadaljuj",
    save: "Shrani",
    cancel: "Prekliči",
    next: "Naprej",
    previous: "Nazaj",
    complete: "Končano",
    loading: "Nalaganje…",
    retry: "Poskusi znova",
    demo: "Demo",
    localDemo: "Lokalni demo v brskalniku",
    configuredRequired: "Potrebna je nastavitev računa",
    more: "Več",
    comingNext: "Sledi",
  },
  nav: {
    home: "Domov",
    learn: "Učenje",
    practice: "Vaja",
    simulator: "Simulator",
    tools: "Finančna orodja",
    review: "Ponavljanje",
    journal: "Dnevnik",
    profile: "Profil",
    glossary: "Slovar",
    progress: "Napredek",
    achievements: "Dosežki",
    settings: "Nastavitve",
  },
  landing: {
    eyebrow: "Interaktivno finančno izobraževanje",
    title: "Razumi finance. Vadi trgovanje. Zgradi resnične tržne veščine.",
    body: "Miren in strukturiran prostor za osnove financ, delovanje trgov, upravljanje tveganj in odgovorno vadbo trgovanja.",
    lessonPreview: "Prava lekcija, ne le katalog tečajev",
    chartPreview: "Preberi graf, preden oceniš odločitev",
    riskTitle: "Tveganje pred donosom",
    riskBody:
      "Velikost pozicije, omejitve izgub in kakovost procesa so pomembnejši od rezultata.",
    multilingual: "Deutsch, Slovenščina in English",
    multilingualBody:
      "Jedro aplikacije in demo lekcija sta na voljo v vseh treh jezikih.",
    toolsTitle: "Orodja z razlago",
    toolsBody:
      "18 kalkulatorjev poveže formulo, primer, razlago in pogoste napake.",
    pathsTitle: "Štiri celovite začetne poti",
    pathsBody:
      "Osnove financ, osnove trgovanja, upravljanje tveganj in tehnična analiza.",
    responsible:
      "Samo izobraževanje in simulacija. Brez investicijskih nasvetov, pravih naročil ali obljub o dobičku.",
  },
  auth: {
    ...de.auth,
    signIn: "Prijava",
    register: "Ustvari račun",
    forgot: "Pozabljeno geslo",
    email: "E-pošta",
    password: "Geslo",
    fullName: "Ime",
    signOut: "Odjava",
    noAccount: "Še nimaš računa?",
    hasAccount: "Že imaš račun?",
    resetIntro: "Poslali ti bomo varno povezavo za ponastavitev.",
    resetSent: "Preveri pošto. Povezava je bila zahtevana.",
    submit: "Varno nadaljuj",
    configurationTitle: "Supabase Auth še ni nastavljen",
    configurationBody:
      "Javni demo ostaja na voljo. Za račune nastavi javni URL in objavljivi ključ.",
    error: "Zahteve ni bilo mogoče dokončati.",
  },
  onboarding: {
    title: "Tvoj učni načrt",
    intro:
      "Osem kratkih odgovorov zadošča za smiselno priporočilo. Nikoli ne sprašujemo po stanju na računu.",
    goal: "Učni cilj",
    level: "Raven izkušenj",
    interest: "Finance ali trgovanje",
    weekly: "Tedenski čas za učenje",
    experience: "Dosedanje tržne izkušnje",
    risk: "Znanje o tveganju",
    style: "Najljubši način učenja",
    placement: "Neobvezno preverjanje znanja",
    placementQuestion:
      "Kaj neposredno najbolj varuje račun pred eno veliko izgubo?",
    recommendation: "Priporočen začetek",
    finish: "Shrani načrt in začni",
  },
  dashboard: {
    welcome: "Dobrodošel nazaj",
    level: "Trenutna raven",
    continueLearning: "Nadaljuj učenje",
    reviewsDue: "Kartice za danes",
    weeklyProgress: "Tedenski napredek",
    mastery: "Obvladovanje veščin",
    streak: "Učni niz",
    simulator: "Povzetek simulatorja",
    journal: "Zadnji zapisi",
    nextLesson: "Naslednja priporočena lekcija",
    weakConcepts: "Ponovi zdaj",
  },
  learn: {
    ...de.learn,
    title: "Učne poti",
    intro: "Gradi znanje v jasnem zaporedju in vidi, kaj se odklene naslednje.",
    activePaths: "Aktivne učne poti",
    skillMap: "Zemljevid veščin",
    available: "Na voljo",
    current: "Trenutno",
    locked: "Manjka predpogoj",
    mastered: "Obvladano",
    lessons: "lekcij",
    minutes: "minut",
    openPath: "Odpri pot",
    objectives: "Učni cilji",
    prerequisites: "Predpogoji",
    modules: "Moduli",
  },
  lesson: {
    objectives: "Kaj se boš naučil",
    core: "Osnovna razlaga",
    visual: "Vizualni primer",
    exercise: "Interaktivna vaja",
    worked: "Rešen primer",
    mistake: "Pogosta napaka",
    takeaway: "Praktičen povzetek",
    check: "Preverjanje znanja",
    cards: "Kartice za ponavljanje",
    sources: "Viri in nadaljnje branje",
    notes: "Zapiski",
    bookmark: "Zaznamek",
    curriculum: "Pregled lekcije",
    glossary: "Pojmi",
    progress: "Napredek lekcije",
    markComplete: "Dokončaj lekcijo",
  },
  quiz: {
    title: "Preverjanje znanja",
    submit: "Preveri odgovor",
    correct: "Pravilno",
    incorrect: "Še ne",
    explanation: "Zakaj",
    alternatives: "Zakaj druge možnosti ne držijo",
    result: "Rezultat",
    reviewConcept: "Dodaj med ponavljanje",
  },
  review: {
    title: "Dnevno ponavljanje",
    intro: "FSRS vsako kartico načrtuje glede na tvoj dejanski priklic.",
    due: "Danes",
    reveal: "Pokaži odgovor",
    again: "Ponovi",
    hard: "Težko",
    good: "Dobro",
    easy: "Lahko",
    complete: "Ponavljanje končano",
    nextDue: "Naslednji rok",
  },
  practice: {
    ...de.practice,
    title: "Laboratorij grafov",
    intro:
      "Vadi opazovanje in razmišljanje o tveganju z determinističnimi simuliranimi svečami.",
    prompt: "Katera tržna struktura je vidna?",
    uptrend: "Naraščajoči trend",
    downtrend: "Padajoči trend",
    range: "Bočno gibanje",
    check: "Preveri razvrstitev",
    replay: "Naslednja sveča",
    simulated: "Deterministični simulirani podatki – niso podatki v živo",
  },
  simulator: {
    ...de.simulator,
    title: "Učni simulator",
    intro:
      "Vadi izvedbo, tveganje in disciplino v ponovljivi zgodovinski simulaciji.",
    warning: "Samo papirno trgovanje. Prava naročila se ne pošiljajo.",
    balance: "Začetno stanje",
    equity: "Vrednost računa",
    play: "Predvajaj",
    pause: "Premor",
    step: "Korak",
    speed: "Hitrost",
    long: "Dolga pozicija",
    short: "Kratka pozicija",
    orderType: "Vrsta naročila",
    size: "Velikost pozicije",
    risk: "Tveganje na posel",
    place: "Oddaj simulirano naročilo",
    close: "Zapri pozicijo",
    positions: "Odprte pozicije",
    pending: "Čakajoča naročila",
    history: "Zgodovina poslov",
    analytics: "Analitika procesa",
    processScore: "Kakovost procesa",
    results: "Oceni scenarij",
  },
  tools: {
    ...de.tools,
    title: "Finančna orodja",
    intro: "Kalkulatorji, ki razložijo odločitev in ne le številke.",
    calculate: "Izračunaj",
    formula: "Formula",
    example: "Primer",
    interpretation: "Razlaga",
    mistake: "Pogosta napaka",
    related: "Povezana lekcija",
    result: "Rezultat",
    invalid: "Preveri, da so vsi vnosi veljavne številke.",
  },
  journal: {
    ...de.journal,
    title: "Trgovalni dnevnik",
    intro:
      "Zapiši načrt, čustva in upoštevanje pravil – ne le dobička ali izgube.",
    setup: "Postavitev",
    thesis: "Teza",
    context: "Tržni kontekst",
    entry: "Vstop",
    stop: "Stop",
    target: "Cilj",
    plannedRisk: "Načrtovano tveganje",
    result: "Rezultat v R",
    emotionBefore: "Čustvo pred vstopom",
    emotionAfter: "Čustvo po izstopu",
    adherence: "Upoštevanje pravil",
    lesson: "Nauk",
    tags: "Oznake",
    add: "Shrani zapis",
    saved: "Shranjeni zapisi",
    repeated: "Ponavljajoče napake",
    patterns: "Čustveni vzorci",
  },
  secondary: {
    glossaryTitle: "Finančni slovar",
    glossaryIntro: "Jasne definicije s praktičnim kontekstom.",
    progressTitle: "Napredek in obvladovanje",
    progressIntro: "Več vrst dokazov pokaže, kaj zares obvladaš.",
    achievementsTitle: "Dosežki",
    achievementsIntro: "Nagrade za disciplino, vajo in iskren razmislek.",
    settingsTitle: "Nastavitve",
    settingsIntro: "Jezik, videz in učne preference.",
    profileTitle: "Profil",
    profileIntro: "Tvoj učni cilj, raven in tedenski načrt na enem mestu.",
  },
};

const en: AcademyDictionary = {
  ...de,
  languageName: "English",
  brand: {
    name: "Borza Academy",
    tagline: "Financial knowledge that improves decisions",
    promise: "Learn finance. Practise trading. Build real market skills.",
  },
  common: {
    start: "Start learning",
    trySimulator: "Try the simulator",
    continue: "Continue",
    save: "Save",
    cancel: "Cancel",
    next: "Next",
    previous: "Previous",
    complete: "Complete",
    loading: "Loading…",
    retry: "Try again",
    demo: "Demo",
    localDemo: "Browser-local demo",
    configuredRequired: "Account configuration required",
    more: "More",
    comingNext: "Coming next",
  },
  nav: {
    home: "Home",
    learn: "Learn",
    practice: "Practice",
    simulator: "Simulator",
    tools: "Finance Tools",
    review: "Review",
    journal: "Journal",
    profile: "Profile",
    glossary: "Glossary",
    progress: "Progress",
    achievements: "Achievements",
    settings: "Settings",
  },
  landing: {
    eyebrow: "Interactive finance education",
    title: "Learn finance. Practise trading. Build real market skills.",
    body: "A calm, structured learning workspace for finance foundations, market mechanics, risk management, and responsible trading practice.",
    lessonPreview: "A real lesson, not just a course catalogue",
    chartPreview: "Read the chart before judging the decision",
    riskTitle: "Risk before return",
    riskBody:
      "Position size, loss limits, and process quality come before outcome thinking.",
    multilingual: "Deutsch, Slovenščina, and English",
    multilingualBody:
      "The core experience and complete demo lesson work in all three languages.",
    toolsTitle: "Tools with explanations",
    toolsBody:
      "18 calculators connect the formula, example, interpretation, and common mistakes.",
    pathsTitle: "Four complete starting paths",
    pathsBody:
      "Finance Foundations, Trading Foundations, Risk Management, and Technical Analysis.",
    responsible:
      "Education and simulation only. No investment advice, live orders, or profit claims.",
  },
  auth: {
    signIn: "Sign in",
    register: "Create account",
    forgot: "Forgot password",
    email: "Email",
    password: "Password",
    fullName: "Name",
    signOut: "Sign out",
    noAccount: "New to Borza?",
    hasAccount: "Already registered?",
    resetIntro: "We will send a secure password-reset link.",
    resetSent: "Check your inbox. The reset link was requested.",
    submit: "Continue securely",
    configurationTitle: "Supabase Auth is not configured yet",
    configurationBody:
      "The public demo remains available. Accounts require the public URL and publishable key.",
    error: "The request could not be completed.",
  },
  onboarding: {
    title: "Your learning plan",
    intro:
      "Eight short answers are enough for a useful recommendation. We never ask for account balances.",
    goal: "Learning goal",
    level: "Experience level",
    interest: "Finance or trading interest",
    weekly: "Weekly study commitment",
    experience: "Prior market experience",
    risk: "Risk knowledge",
    style: "Preferred learning style",
    placement: "Optional placement check",
    placementQuestion:
      "What most directly protects an account from one unusually large loss?",
    recommendation: "Recommended start",
    finish: "Save plan and begin",
  },
  dashboard: {
    welcome: "Welcome back",
    level: "Current level",
    continueLearning: "Continue learning",
    reviewsDue: "Cards due today",
    weeklyProgress: "Weekly progress",
    mastery: "Skill mastery",
    streak: "Study streak",
    simulator: "Simulator summary",
    journal: "Recent journal notes",
    nextLesson: "Recommended next lesson",
    weakConcepts: "Review now",
  },
  learn: {
    title: "Learning paths",
    intro: "Build skills in a clear sequence and see what unlocks next.",
    activePaths: "Active learning paths",
    skillMap: "Skill map",
    available: "Available",
    current: "Current",
    locked: "Prerequisite needed",
    mastered: "Mastered",
    lessons: "lessons",
    minutes: "minutes",
    openPath: "Open path",
    objectives: "Learning objectives",
    prerequisites: "Prerequisites",
    modules: "Modules",
  },
  lesson: {
    objectives: "What you will learn",
    core: "Core explanation",
    visual: "Visual example",
    exercise: "Interactive exercise",
    worked: "Worked example",
    mistake: "Common mistake",
    takeaway: "Practical takeaway",
    check: "Knowledge check",
    cards: "Review cards",
    sources: "Sources and further reading",
    notes: "Notes",
    bookmark: "Bookmark",
    curriculum: "Lesson outline",
    glossary: "Glossary",
    progress: "Lesson progress",
    markComplete: "Complete lesson",
  },
  quiz: {
    title: "Knowledge check",
    submit: "Check answer",
    correct: "Correct",
    incorrect: "Not yet",
    explanation: "Why",
    alternatives: "Why the alternatives do not fit",
    result: "Result",
    reviewConcept: "Add concept to review",
  },
  review: {
    title: "Daily review",
    intro: "FSRS reschedules each card from your actual recall.",
    due: "Due today",
    reveal: "Reveal answer",
    again: "Again",
    hard: "Hard",
    good: "Good",
    easy: "Easy",
    complete: "Review complete",
    nextDue: "Next due",
  },
  practice: {
    title: "Chart laboratory",
    intro:
      "Train observation and risk thinking with deterministic simulated candles.",
    prompt: "Which market structure is visible?",
    uptrend: "Uptrend",
    downtrend: "Downtrend",
    range: "Range",
    check: "Check classification",
    replay: "Reveal next candle",
    simulated: "Deterministic simulated data — not live market data",
    attribution: "Charts powered by TradingView Lightweight Charts™",
  },
  simulator: {
    title: "Learning simulator",
    intro:
      "Practice execution, risk, and discipline in a reproducible historical simulation.",
    warning: "Paper trading only. No real order is ever transmitted.",
    balance: "Starting balance",
    equity: "Equity",
    play: "Play",
    pause: "Pause",
    step: "Step",
    speed: "Speed",
    long: "Long",
    short: "Short",
    orderType: "Order type",
    market: "Market",
    limit: "Limit",
    stop: "Stop",
    bracket: "Bracket",
    size: "Position size",
    risk: "Risk per trade",
    spread: "Spread",
    commission: "Commission",
    slippage: "Slippage",
    place: "Place simulated order",
    close: "Close position",
    positions: "Open positions",
    pending: "Pending orders",
    history: "Trade history",
    analytics: "Process analytics",
    processScore: "Process quality",
    results: "Review scenario",
  },
  tools: {
    title: "Finance tools",
    intro: "Calculators that explain the decision, not just the number.",
    calculate: "Calculate",
    formula: "Formula",
    example: "Worked example",
    interpretation: "Interpretation",
    mistake: "Common mistake",
    related: "Related lesson",
    result: "Result",
    invalid: "Check that every input is a valid number.",
  },
  journal: {
    title: "Trading journal",
    intro:
      "Record the plan, emotions, and rule adherence—not only profit or loss.",
    setup: "Setup",
    thesis: "Thesis",
    context: "Market context",
    entry: "Entry",
    stop: "Stop",
    target: "Target",
    plannedRisk: "Planned risk",
    result: "Result in R",
    emotionBefore: "Emotion before entry",
    emotionAfter: "Emotion after exit",
    adherence: "Rules followed",
    lesson: "Lesson learned",
    tags: "Tags",
    add: "Save entry",
    saved: "Saved entries",
    repeated: "Repeated mistakes",
    patterns: "Emotional patterns",
  },
  secondary: {
    glossaryTitle: "Finance glossary",
    glossaryIntro: "Clear definitions with practical context.",
    progressTitle: "Progress and mastery",
    progressIntro:
      "Multiple evidence types show what you genuinely understand.",
    achievementsTitle: "Achievements",
    achievementsIntro:
      "Recognition for discipline, practice, and honest reflection.",
    settingsTitle: "Settings",
    settingsIntro: "Language, appearance, and learning preferences.",
    profileTitle: "Profile",
    profileIntro: "Your learning goal, level, and weekly plan in one place.",
  },
};

export const dictionaries: Record<Language, AcademyDictionary> = { de, sl, en };

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    SUPPORTED_LANGUAGES.some((language) => language === value)
  );
}
