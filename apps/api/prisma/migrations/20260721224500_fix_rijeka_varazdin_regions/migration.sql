INSERT INTO "Region" ("name", "slug", "sortOrder")
VALUES
  ('Istra i Kvarner', 'istra-i-kvarner', 3),
  ('Međimurje i Zagorje', 'medimurje-i-zagorje', 6)
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name";

INSERT INTO "County" ("name", "slug", "regionId")
SELECT 'Primorsko-goranska', 'primorsko-goranska', r.id
FROM "Region" r
WHERE r.slug = 'istra-i-kvarner'
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "regionId" = EXCLUDED."regionId";

INSERT INTO "County" ("name", "slug", "regionId")
SELECT 'Varaždinska', 'varazdinska', r.id
FROM "Region" r
WHERE r.slug = 'medimurje-i-zagorje'
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "regionId" = EXCLUDED."regionId";

UPDATE "City" c
SET "countyId" = county.id,
    "lat" = COALESCE(c."lat", 45.3271),
    "lng" = COALESCE(c."lng", 14.4422)
FROM "County" county
WHERE lower(c.name) = lower('Rijeka')
  AND county.slug = 'primorsko-goranska';

UPDATE "City" c
SET "countyId" = county.id,
    "lat" = COALESCE(c."lat", 46.3057),
    "lng" = COALESCE(c."lng", 16.3366)
FROM "County" county
WHERE lower(c.name) = lower('Varaždin')
  AND county.slug = 'varazdinska';

UPDATE "Event" e
SET "countyId" = c."countyId",
    "regionId" = county."regionId",
    "lat" = COALESCE(e."lat", c."lat"),
    "lng" = COALESCE(e."lng", c."lng")
FROM "City" c
JOIN "County" county ON county.id = c."countyId"
WHERE e."cityId" = c.id
  AND lower(c.name) IN (lower('Rijeka'), lower('Varaždin'));

UPDATE "Event" e
SET "countyId" = county.id,
    "regionId" = county."regionId"
FROM "County" county
WHERE lower(e."cityName") = lower('Rijeka')
  AND county.slug = 'primorsko-goranska';

UPDATE "Event" e
SET "countyId" = county.id,
    "regionId" = county."regionId"
FROM "County" county
WHERE lower(e."cityName") = lower('Varaždin')
  AND county.slug = 'varazdinska';
