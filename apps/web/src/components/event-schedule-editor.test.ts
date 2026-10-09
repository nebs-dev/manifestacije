import { describe, expect, it } from "vitest"
import { addWeek, clearScheduleRowEnd, patchScheduleRow, scheduleRowsFromEvent, scheduleRowsToApi } from "../lib/schedule-editor-model"

describe("schedule editor serialization", () => {
  it("preserves a legacy multi-day range until explicitly converted", () => {
    const rows = scheduleRowsFromEvent({
      startsAt: "2026-08-14T08:00:00+02:00",
      endsAt: "2026-08-16T22:00:00+02:00",
      isAllDay: false,
    })
    expect(rows[0].endDate).toBe("2026-08-16")
    expect(scheduleRowsToApi(rows)[0]).toEqual({
      startsAt: "2026-08-14T06:00:00.000Z",
      endsAt: "2026-08-16T20:00:00.000Z",
      isAllDay: false,
    })
  })

  it("treats an earlier end time as overnight", () => {
    const [serialized] = scheduleRowsToApi([{
      key: "overnight",
      date: "2026-08-14",
      startTime: "22:00",
      endTime: "02:00",
      isAllDay: false,
    }])
    expect(serialized.startsAt).toBe("2026-08-14T20:00:00.000Z")
    expect(serialized.endsAt).toBe("2026-08-15T00:00:00.000Z")
  })

  it("advances a date by a week, rolling over the month when needed", () => {
    expect(addWeek("2026-08-20")).toBe("2026-08-27")
    expect(addWeek("2026-08-27")).toBe("2026-09-03")
  })
})

 it.each(["00:00", "24:00"])("preserves midnight end %s as the next midnight timestamp", endTime => {
  const [saved] = scheduleRowsToApi([{ key: "midnight", date: "2026-09-10", startTime: "18:00", endTime, isAllDay: false }])
  expect(saved.endsAt).toBe("2026-09-10T22:00:00.000Z")
  const rows = scheduleRowsFromEvent(saved)
  expect(rows[0].endDate).toBeUndefined()
  expect(scheduleRowsToApi(rows)[0].endsAt).toBe(saved.endsAt)
 })

describe("EVT-06 schedule end editing", () => {
  const timed = { key: "r", date: "2026-08-14", startTime: "18:00", endTime: "22:00", isAllDay: false }

  it("sends endsAt null (not undefined) when the end is cleared so the API clears it", () => {
    const [saved] = scheduleRowsToApi([clearScheduleRowEnd({ ...timed, endDate: "2026-08-16" })])
    expect(saved.endsAt).toBeNull()
    expect(JSON.parse(JSON.stringify(saved))).toHaveProperty("endsAt", null)
    expect(saved.startsAt).toBe("2026-08-14T16:00:00.000Z")
  })

  it("clearing the end keeps the start date, start time and all-day flag", () => {
    expect(clearScheduleRowEnd({ ...timed, endDate: "2026-08-16" })).toEqual({ ...timed, endTime: "", endDate: undefined })
    expect(clearScheduleRowEnd({ key: "a", date: "2026-08-14", endDate: "2026-08-16", startTime: "", endTime: "", isAllDay: true }))
      .toEqual({ key: "a", date: "2026-08-14", endDate: undefined, startTime: "", endTime: "", isAllDay: true })
  })

  it("no longer silently drops an end date when the end time is empty", () => {
    expect(() => scheduleRowsToApi([{ ...timed, endTime: "", endDate: "2026-08-16" }])).toThrow("Uz datum završetka unesite i vrijeme završetka")
  })

  it("rejects an end date before the start date", () => {
    expect(() => scheduleRowsToApi([{ ...timed, endDate: "2026-08-13" }])).toThrow("Datum završetka ne može biti prije datuma početka.")
  })

  it("lets a new timed event get a multi-day end", () => {
    const [saved] = scheduleRowsToApi([patchScheduleRow(timed, { endDate: "2026-08-16" })])
    expect(saved.endsAt).toBe("2026-08-16T20:00:00.000Z")
  })

  it("lets a new all-day event span several days and clear back to one day", () => {
    const allDay = { key: "a", date: "2026-08-14", startTime: "", endTime: "", isAllDay: true }
    const [multi] = scheduleRowsToApi([patchScheduleRow(allDay, { endDate: "2026-08-16" })])
    expect(multi).toEqual({ startsAt: "2026-08-13T22:00:00.000Z", endsAt: "2026-08-16T21:59:00.000Z", isAllDay: true })
    const [single] = scheduleRowsToApi([clearScheduleRowEnd(patchScheduleRow(allDay, { endDate: "2026-08-16" }))])
    expect(single.endsAt).toBe("2026-08-14T21:59:00.000Z")
  })

  it("moving the start date keeps the multi-day length", () => {
    const moved = patchScheduleRow({ ...timed, endDate: "2026-08-16" }, { date: "2026-08-28" })
    expect(moved.endDate).toBe("2026-08-30")
    expect(scheduleRowsToApi([moved])[0].endsAt).toBe("2026-08-30T20:00:00.000Z")
  })

  it("an end date equal to the start date means a same-day end", () => {
    expect(patchScheduleRow(timed, { endDate: "2026-08-14" }).endDate).toBeUndefined()
  })

  it("round-trips an existing overnight event without an explicit end date", () => {
    const rows = scheduleRowsFromEvent({ startsAt: "2026-08-14T20:00:00.000Z", endsAt: "2026-08-15T00:00:00.000Z", isAllDay: false })
    expect(rows[0]).toEqual(expect.objectContaining({ date: "2026-08-14", startTime: "22:00", endTime: "02:00", endDate: undefined }))
    expect(scheduleRowsToApi(rows)[0].endsAt).toBe("2026-08-15T00:00:00.000Z")
    // Moving an overnight event keeps it overnight.
    const [moved] = scheduleRowsToApi([patchScheduleRow(rows[0], { date: "2026-08-21" })])
    expect(moved.endsAt).toBe("2026-08-22T00:00:00.000Z")
  })

  it("round-trips existing single-day, all-day and multi-day events unchanged", () => {
    for (const event of [
      { startsAt: "2026-08-14T16:00:00.000Z", endsAt: "2026-08-14T20:00:00.000Z", isAllDay: false },
      { startsAt: "2026-08-14T16:00:00.000Z", endsAt: null, isAllDay: false },
      { startsAt: "2026-08-13T22:00:00.000Z", endsAt: "2026-08-16T21:59:00.000Z", isAllDay: true },
      { startsAt: "2026-08-14T06:00:00.000Z", endsAt: "2026-08-16T20:00:00.000Z", isAllDay: false },
    ]) {
      expect(scheduleRowsToApi(scheduleRowsFromEvent(event))[0]).toEqual(event)
    }
  })
})
