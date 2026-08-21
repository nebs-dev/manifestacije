"use client"

import { Copy, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { addWeek, emptyScheduleRow, type ScheduleRow } from "@/lib/schedule-editor-model"

export { emptyScheduleRow, scheduleRowsFromEvent, scheduleRowsToApi } from "@/lib/schedule-editor-model"
export type { ScheduleRow } from "@/lib/schedule-editor-model"

export function EventScheduleEditor({
  rows,
  onChange,
  disabled = false,
}: {
  rows: ScheduleRow[]
  onChange: (rows: ScheduleRow[]) => void
  disabled?: boolean
}) {
  const update = (key: string, patch: Partial<ScheduleRow>) => onChange(rows.map((row) => {
    if (row.key !== key) return row
    if (patch.date && row.endDate === row.date) return { ...row, ...patch, endDate: patch.date }
    return { ...row, ...patch }
  }))
  // Weekly recurring events (e.g. "every Thursday 17-18") are the common case —
  // duplicating a row a week later re-enters the same times with one click
  // instead of retyping them for every occurrence.
  const duplicateRow = (row: ScheduleRow) => {
    const index = rows.findIndex((item) => item.key === row.key)
    const copy: ScheduleRow = {
      ...row,
      key: `new-${Date.now()}-${Math.random()}`,
      id: undefined,
      date: row.date ? addWeek(row.date) : "",
      endDate: row.endDate ? addWeek(row.endDate) : undefined,
    }
    onChange([...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)])
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <div key={row.key} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <Label>Datum</Label>
            <Input type="date" value={row.date} disabled={disabled} onChange={(event) => update(row.key, { date: event.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Početak</Label>
            <Input type="time" value={row.startTime} disabled={disabled || row.isAllDay} onChange={(event) => update(row.key, { startTime: event.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Završetak</Label>
            <Input type="time" value={row.endTime} disabled={disabled || row.isAllDay} onChange={(event) => update(row.key, { endTime: event.target.value })} />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={row.isAllDay} disabled={disabled} onCheckedChange={(value) => update(row.key, { isAllDay: value })} />
              Cijeli dan
            </label>
            <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Dupliciraj termin ${index + 1} tjedan poslije`} onClick={() => duplicateRow(row)}>
              <Copy className="size-4" />
            </Button>
            {rows.length > 1 && (
              <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Ukloni termin ${index + 1}`} onClick={() => onChange(rows.filter((item) => item.key !== row.key))}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
          {row.endDate && row.endDate !== row.date && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Datum završetka</Label>
              <Input type="date" value={row.endDate} disabled={disabled} onChange={(event) => update(row.key, { endDate: event.target.value || undefined })} />
            </div>
          )}
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...rows, emptyScheduleRow()])}>
          <Plus className="size-4" /> Dodaj datum/vrijeme
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Završetak raniji od početka računa se kao sljedeći dan.</p>
    </div>
  )
}
