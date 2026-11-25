/**
 * Near-duplicate venues (VEN-06).
 *
 * `@@unique([slug, cityId])` already rules out two venues with the same name
 * in the same city, so duplicates here are the human kind: "Oxygene" and
 * "Klub Oxygene", "Dom kulture" and "Dom kulture Osijek". They accumulate
 * because every event entered with a slightly different venue name creates
 * another row, and each one then remembers a different address.
 *
 * Only venues in the same city are ever paired. Two towns with a "Dvorana"
 * are two different places, and merging them would move events to an address
 * on the other side of the country — the same mistake VEN-05 guards against
 * in the autocomplete.
 */

export type VenueLike = { id: number; name: string; cityId: number; cityName?: string; address?: string | null; eventCount?: number };

/** Words that say what kind of place it is, not which place it is. */
const GENERIC = ["klub", "club", "caffe", "cafe", "kafic", "bar", "restoran", "dvorana", "centar", "galerija", "kino", "disco", "disko"];

const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** The distinctive part of a name: "Klub Oxygene" and "Oxygene" share it. */
export function venueKey(name: string): string {
  const words = fold(name).split(" ").filter(word => word && !GENERIC.includes(word));
  return (words.length ? words : fold(name).split(" ")).join(" ");
}

/** Edit distance, capped: beyond two edits the pair is not a typo. */
function withinOneOrTwoEdits(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length] <= 2;
}

export function looksLikeSameVenue(a: string, b: string): boolean {
  const left = venueKey(a);
  const right = venueKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  // One name inside the other ("Dom kulture" / "Dom kulture Osijek"), but not
  // a single letter inside a word: "O2" must not swallow "Oxygene".
  const shorter = left.length <= right.length ? left : right;
  const longer = shorter === left ? right : left;
  if (shorter.length >= 4 && (longer.startsWith(`${shorter} `) || longer.endsWith(` ${shorter}`) || longer.includes(` ${shorter} `))) return true;
  return shorter.length >= 5 && withinOneOrTwoEdits(left, right);
}

export type VenueDuplicateGroup = { cityId: number; cityName?: string; venues: VenueLike[] };

/** Groups of venues in one city that look like the same place. Venues with
 *  more events come first inside a group: that is the one an editor will
 *  usually keep, though the choice stays theirs. */
export function venueDuplicateGroups(venues: VenueLike[]): VenueDuplicateGroup[] {
  const byCity = new Map<number, VenueLike[]>();
  for (const venue of venues) byCity.set(venue.cityId, [...(byCity.get(venue.cityId) ?? []), venue]);

  const groups: VenueDuplicateGroup[] = [];
  for (const [cityId, cityVenues] of byCity) {
    const remaining = [...cityVenues];
    while (remaining.length) {
      const seed = remaining.shift()!;
      const group = [seed];
      for (let index = remaining.length - 1; index >= 0; index--) {
        if (group.some(member => looksLikeSameVenue(member.name, remaining[index].name))) {
          group.unshift(...remaining.splice(index, 1));
        }
      }
      if (group.length > 1) {
        groups.push({
          cityId,
          cityName: seed.cityName,
          venues: group.sort((a, b) => (b.eventCount ?? 0) - (a.eventCount ?? 0) || a.name.localeCompare(b.name, "hr")),
        });
      }
    }
  }
  return groups.sort((a, b) =>
    b.venues.reduce((sum, venue) => sum + (venue.eventCount ?? 0), 0) - a.venues.reduce((sum, venue) => sum + (venue.eventCount ?? 0), 0));
}
