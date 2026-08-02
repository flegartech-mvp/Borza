import { describe, expect, it } from "vitest";
import { dictionaries } from "./dictionaries";

describe("Academy brand promise", () => {
  it("uses the approved copy in all three languages", () => {
    expect(dictionaries.de.landing.title).toBe("Finanzen verstehen. Trading üben. Marktfähigkeiten aufbauen.");
    expect(dictionaries.sl.landing.title).toBe("Razumi finance. Vadi trgovanje. Zgradi resnične tržne veščine.");
    expect(dictionaries.en.landing.title).toBe("Learn finance. Practise trading. Build real market skills.");
    expect(dictionaries.en.brand.promise).toBe(dictionaries.en.landing.title);
  });
});
