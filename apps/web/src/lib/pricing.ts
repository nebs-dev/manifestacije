/** Nullable isFree is the wire/storage contract; only manual creation defaults to true. */
export type PricingValue = boolean | null
export const PRICING_OPTIONS = [
  { value: "FREE", label: "Besplatno", isFree: true },
  { value: "PAID", label: "Naplata", isFree: false },
  { value: "UNKNOWN", label: "Cijena nije navedena", isFree: null },
] as const
export function pricingState(value: PricingValue | undefined) {
  return value === true ? "FREE" : value === false ? "PAID" : "UNKNOWN"
}
export function pricingValue(state: string): PricingValue {
  return state === "FREE" ? true : state === "PAID" ? false : null
}
export function pricingLabel(value: PricingValue | undefined, price?: string | null) {
  if (value === true) return "Besplatno"
  if (value === false) return price?.trim() || "Naplata"
  return "Cijena nije navedena"
}
