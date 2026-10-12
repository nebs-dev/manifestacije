"use client"

import { PRICING_OPTIONS, pricingState, pricingValue, type PricingValue } from "@/lib/pricing"

export function PricingSelect({ value, onChange, disabled, id, label = "Način naplate" }: {
  value: PricingValue; onChange: (value: PricingValue) => void; disabled?: boolean; id?: string; label?: string
}) {
  return <select id={id} aria-label={label} value={pricingState(value)} disabled={disabled}
    onChange={event => onChange(pricingValue(event.target.value))}
    className="h-9 max-w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
    {PRICING_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>
}
