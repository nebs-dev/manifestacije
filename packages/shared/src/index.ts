export const CROATIAN_REGIONS = [
  "Slavonija i Baranja",
  "Zagreb i okolica",
  "Dalmacija",
  "Istra i Kvarner",
  "Sredisnja Hrvatska",
  "Lika i Gorski kotar",
  "Medjimurje i Zagorje"
] as const;

export type PublicEventFilter = {
  region?: string;
  county?: string;
  city?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  today?: string;
  weekend?: string;
  free?: string;
  search?: string;
};
