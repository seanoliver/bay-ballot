export const SEEN_KEY = "bb-area";
// Same key as the address filter's DISTRICTS_KEY.
export const DISTRICTS_KEY = "bb-districts";

export function homeRedirect({
  query,
  storedFilters,
  storedDistricts,
  seen,
}: {
  query: string;
  storedFilters: string | null;
  storedDistricts: string | null;
  seen: string | null;
}): string | null {
  if (seen !== null || query.replace(/^\?/, "") !== "") return null;
  if (storedDistricts?.startsWith("sf.") || (storedFilters ?? "") !== "") return "sf";
  return null;
}
