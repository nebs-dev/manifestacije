import { describe, expect, it } from "vitest"
import { addWeek, scheduleRowsFromEvent, scheduleRowsToApi } from "../lib/schedule-editor-model"

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
