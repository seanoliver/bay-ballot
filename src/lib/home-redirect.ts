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

export type HomeStores = { local: KeyValueStore | null; session?: KeyValueStore | null };

const readFrom = (store: KeyValueStore | null | undefined, key: string) => {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const writeTo = (store: KeyValueStore | null | undefined, key: string, value: string) => {
  try {
    store?.setItem(key, value);
    return store != null;
  } catch {
    return false;
  }
};

export function createHomeVisit() {
  let seenHere: string | null = null;
  return ({ local, session }: HomeStores, { area, query }: { area: string | null; query: string }): string | null => {
    const read = (key: string) => readFrom(local, key);
    const seen = read(SEEN_KEY) ?? readFrom(session, SEEN_KEY) ?? seenHere;
    const target =
      area === null ? homeRedirect({ query, storedFilters: read(FILTERS_KEY), storedDistricts: read(DISTRICTS_KEY), seen }) : null;
    if (query.replace(/^\?/, "") !== "") return target;
    seenHere = area ?? "bay-area";
    if (!writeTo(local, SEEN_KEY, seenHere)) writeTo(session, SEEN_KEY, seenHere);
    return target;
  };
}
