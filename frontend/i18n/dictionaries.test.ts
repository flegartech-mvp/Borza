import { describe, expect, it } from "vitest";
import { dictionaries } from "./dictionaries";

describe("Academy brand promise", () => {
  it("keeps the approved promise while the homepage leads with the decision benefit", () => {
    expect(dictionaries.de.brand.promise).toBe(
      "Finanzen verstehen. Trading üben. Marktfähigkeiten aufbauen.",
    );
    expect(dictionaries.sl.brand.promise).toBe(
      "Razumi finance. Vadi trgovanje. Zgradi resnične tržne veščine.",
    );
    expect(dictionaries.en.brand.promise).toBe(
      "Learn finance. Practise trading. Build real market skills.",
    );
    expect(dictionaries.en.landing.title).toBe(
      "Make better financial decisions before real money makes the lesson expensive.",
    );
  });
});
