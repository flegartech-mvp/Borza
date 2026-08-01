import { describe, expect, it } from "vitest";
import worldMap from "world-atlas/countries-110m.json";
import {
  COUNTRY_METADATA,
  getAtlasCountryName,
  getCountryByAlpha2,
  getCountryByAtlasName,
  getCountryByName,
  getCountryRegion,
  normalizeCountryCode,
  normalizeCountryName,
} from "./country-metadata";

describe("country metadata", () => {
  it("resolves Slovenia and Croatia by ISO alpha-2 code", () => {
    expect(getCountryByAlpha2("SI")?.name).toBe("Slovenia");
    expect(getCountryByAlpha2("HR")?.name).toBe("Croatia");
    expect(getCountryByAlpha2("SVN")?.alpha2).toBe("SI");
  });

  it("uses the world-atlas display name for the United States", () => {
    expect(getAtlasCountryName("US")).toBe("United States of America");
    expect(getCountryByName("United States")?.alpha2).toBe("US");
  });

  it("resolves Czech aliases to the same country", () => {
    expect(getCountryByName("Czech Republic")?.alpha2).toBe("CZ");
    expect(getCountryByName("Czechia")?.alpha2).toBe("CZ");
  });

  it("resolves UK and GB to the same country", () => {
    expect(getCountryByName("UK")?.alpha2).toBe("GB");
    expect(getCountryByAlpha2("GB")?.alpha2).toBe("GB");
  });

  it("resolves South Korea and distinguishes the two Congos", () => {
    expect(getCountryByName("South Korea")?.alpha2).toBe("KR");
    expect(getCountryByName("DR Congo")?.alpha2).toBe("CD");
    expect(getCountryByName("Republic of the Congo")?.alpha2).toBe("CG");
  });

  it("returns null safely for invalid codes", () => {
    expect(normalizeCountryCode(" ")).toBeNull();
    expect(normalizeCountryCode("ZZ")).toBeNull();
    expect(getCountryByAlpha2("not-a-country")).toBeNull();
    expect(getCountryByName("Not a real country")).toBeNull();
  });

  it("normalizes alpha codes, punctuation, and common aliases", () => {
    expect(normalizeCountryCode(" si ")).toBe("SI");
    expect(normalizeCountryCode("SVN")).toBe("SI");
    expect(normalizeCountryName("  Côte d’Ivoire  ")).toBe("cote divoire");
    expect(getCountryByName("U.S.A.")?.alpha2).toBe("US");
    expect(getCountryByName("Cote d'Ivoire")?.alpha2).toBe("CI");
    expect(getCountryByAtlasName("Dem. Rep. Congo")?.alpha2).toBe("CD");
  });

  it("resolves every supported ISO alpha-2 country to complete metadata", () => {
    expect(COUNTRY_METADATA).toHaveLength(250);

    for (const country of COUNTRY_METADATA) {
      const resolved = getCountryByAlpha2(country.alpha2);
      expect(resolved).not.toBeNull();
      expect(resolved?.alpha2).toBe(country.alpha2);
      expect(resolved?.name).toBeTruthy();
      expect(resolved?.region).toBeTruthy();
      expect(getCountryRegion(country.alpha2)).toBe(country.region);
      expect(getCountryByAlpha2(country.alpha3)?.alpha2).toBe(country.alpha2);
    }
  });

  it("matches every ISO-backed country in world-atlas", () => {
    const atlasCountries = (
      worldMap as {
        objects: {
          countries: { geometries: Array<{ properties?: { name?: string } }> };
        };
      }
    ).objects.countries.geometries;
    const unmatched = atlasCountries
      .map((geometry) => geometry.properties?.name)
      .filter((name): name is string =>
        Boolean(name && !getCountryByAtlasName(name)),
      )
      .sort();

    expect(unmatched).toEqual(["Somaliland"]);
  });
});
