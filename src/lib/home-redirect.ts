import { FILTERS_KEY } from "./filters";

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

export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

export function createHomeVisit() {
  let seenHere: string | null = null;
  return (store: KeyValueStore | null, { area, query }: { area: string | null; query: string }): string | null => {
    const read = (key: string) => {
      try {
        return store?.getItem(key) ?? null;
      } catch {
        return null;
      }
    };
    const target =
      area === null
        ? homeRedirect({ query, storedFilters: read(FILTERS_KEY), storedDistricts: read(DISTRICTS_KEY), seen: read(SEEN_KEY) ?? seenHere })
        : null;
    seenHere = area ?? "bay-area";
    try {
      store?.setItem(SEEN_KEY, seenHere);
    } catch {
    }
    return target;
  };
}
