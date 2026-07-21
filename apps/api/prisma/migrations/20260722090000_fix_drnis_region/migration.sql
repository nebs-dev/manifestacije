INSERT INTO "Region" ("name", "slug", "sortOrder")
VALUES ('Dalmacija', 'dalmacija', 2)
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name";

INSERT INTO "County" ("name", "slug", "regionId")
SELECT 'Šibensko-kninska', 'sibensko-kninska', r.id
FROM "Region" r
WHERE r.slug = 'dalmacija'
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "regionId" = EXCLUDED."regionId";

UPDATE "City" c
SET "countyId" = county.id,
    "lat" = COALESCE(c."lat", 43.8625),
    "lng" = COALESCE(c."lng", 16.1556)
FROM "County" county
WHERE lower(c.name) = lower('Drniš')
  AND county.slug = 'sibensko-kninska';

UPDATE "Event" e
SET "countyId" = c."countyId",
    "regionId" = county."regionId",
    "lat" = COALESCE(e."lat", c."lat"),
    "lng" = COALESCE(e."lng", c."lng")
FROM "City" c
JOIN "County" county ON county.id = c."countyId"
WHERE e."cityId" = c.id
  AND lower(c.name) = lower('Drniš');

UPDATE "Event" e
SET "countyId" = county.id,
    "regionId" = county."regionId",
    "lat" = COALESCE(e."lat", 43.8625),
    "lng" = COALESCE(e."lng", 16.1556)
FROM "County" county
WHERE lower(e."cityName") = lower('Drniš')
  AND county.slug = 'sibensko-kninska';

