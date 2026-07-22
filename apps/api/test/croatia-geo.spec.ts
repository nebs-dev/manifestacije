import { fallbackCityGeo, normalizeCountyName, COUNTY_TO_REGION_SLUG } from "../src/common/croatia-geo";

describe("croatia geo fallback", () => {
  it("maps Rijeka to Primorsko-goranska and Istra/Kvarner without network lookup", () => {
    const geo = fallbackCityGeo("Rijeka");

    expect(geo).toEqual(expect.objectContaining({ countyName: "Primorsko-goranska" }));
    expect(COUNTY_TO_REGION_SLUG[geo!.countyName]).toBe("istra-i-kvarner");
  });

  it("maps Varaždin to Varaždinska and Međimurje/Zagorje without network lookup", () => {
    const geo = fallbackCityGeo("Varaždin");

    expect(geo).toEqual(expect.objectContaining({ countyName: "Varaždinska" }));
    expect(COUNTY_TO_REGION_SLUG[geo!.countyName]).toBe("medimurje-i-zagorje");
  });

  it("maps Drniš to Šibensko-kninska and Dalmacija without network lookup", () => {
    const geo = fallbackCityGeo("Drniš");

    expect(geo).toEqual(expect.objectContaining({ countyName: "Šibensko-kninska" }));
    expect(COUNTY_TO_REGION_SLUG[geo!.countyName]).toBe("dalmacija");
  });

  it("maps Belišće to Osječko-baranjska and Slavonija/Baranja without network lookup", () => {
    const geo = fallbackCityGeo("Belišće");

    expect(geo).toEqual(expect.objectContaining({ countyName: "Osječko-baranjska" }));
    expect(COUNTY_TO_REGION_SLUG[geo!.countyName]).toBe("slavonija-i-baranja");
  });

  it("normalizes county names returned by external geocoders", () => {
    expect(normalizeCountyName("Primorsko-goranska županija")).toBe("Primorsko-goranska");
    expect(normalizeCountyName("Primorje-Gorski Kotar County")).toBe("Primorsko-goranska");
    expect(normalizeCountyName("Sibenik-Knin County")).toBe("Šibensko-kninska");
    expect(normalizeCountyName("Varaždinska županija")).toBe("Varaždinska");
    expect(normalizeCountyName("Osijek-Baranja County")).toBe("Osječko-baranjska");
  });
});
