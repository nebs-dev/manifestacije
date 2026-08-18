"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { emptyScheduleRow, type ScheduleRow } from "@/lib/schedule-editor-model"

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
