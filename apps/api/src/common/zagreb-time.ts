export const ZAGREB_ZONE = "Europe/Zagreb";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZAGREB_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function zagrebDateKey(date = new Date()): string {
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Resolve wall time only when it identifies one instant. DST gaps and folds
 * require review; silently choosing either side would change the event time. */
export function parseZagrebWallTime(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) return "";
  const wall = `${date}T${time.length === 5 ? `${time}:00` : time}`;
  const rough = Date.parse(`${wall}Z`);
  if (!Number.isFinite(rough) || new Date(rough).toISOString().slice(0, 19) !== wall) return "";
  const offsets = new Set<number>();
  for (const hours of [-36, 0, 36]) {
    const instant = rough + hours * 3_600_000;
    const parts = formatter.formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    offsets.add(Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - instant);
  }
  const matches = [...offsets].flatMap((offset) => {
    const instant = new Date(rough - offset);
    const parts = formatter.formatToParts(instant);
    const get = (type: string) => parts.find((p) => p.type === type)!.value;
    const rendered = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
    if (rendered !== wall) return [];
    const minutes = offset / 60_000;
    return [`${wall}${minutes < 0 ? "-" : "+"}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0")}:${String(Math.abs(minutes) % 60).padStart(2, "0")}`];
  });
  return matches.length === 1 ? matches[0] : "";
}
