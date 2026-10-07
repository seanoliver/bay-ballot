import type { Area, Contest } from "@/lib/schema";

const state = { level: "state" as const, name: "California" };
const county = (name: string) => ({ level: "county" as const, name });
const city = (name: string) => ({ level: "city" as const, name });

export const SF: Area = { id: "sf", name: "San Francisco", shortName: "SF", kind: "city", jurisdictions: [state, county("San Francisco"), city("San Francisco")] };
export const SM: Area = {
  id: "san-mateo", name: "San Mateo County", kind: "county",
  jurisdictions: [state, county("San Mateo"), city("Menlo Park"), city("Redwood City"), city("San Mateo")],
};
export const PA: Area = { id: "palo-alto", name: "Palo Alto", kind: "city", jurisdictions: [state, county("Santa Clara"), city("Palo Alto")] };
export const MV: Area = { id: "mountain-view", name: "Mountain View", kind: "city", jurisdictions: [state, county("Santa Clara"), city("Mountain View")] };
export const SCC: Area = { id: "santa-clara-county", name: "Santa Clara County", kind: "county", jurisdictions: [state, county("Santa Clara"), city("Palo Alto"), city("Mountain View")] };
export const OAK: Area = { id: "oakland", name: "Oakland", kind: "city", jurisdictions: [state, county("Alameda"), city("Oakland")] };

export const c = (id: string, jurisdiction: Contest["jurisdiction"]) =>
  ({ id, section: "S", title: id, kind: "measure", candidates: [], seats: 1, rankedChoice: false, jurisdiction }) as Contest;
export const prop1 = c("prop-1", state);
export const propB = c("prop-b", city("San Francisco"));
export const sup8 = c("supervisor-8", { level: "district", name: "Supervisor", district: "8", within: [county("San Francisco")] });
export const rep15 = c("us-rep-15", { level: "district", name: "Congress", district: "15", within: [county("San Francisco"), county("San Mateo")] });
export const rtm = c("rtm", { level: "region", name: "Bay Area", within: [county("San Francisco"), county("San Mateo"), county("Santa Clara")] });
export const smL = c("san-mateo-county-measure-l", county("San Mateo"));
export const mpP = c("menlo-park-measure-p", city("Menlo Park"));
export const rc2 = c("redwood-city-council-2", { level: "district", name: "City Council", district: "2", within: [city("Redwood City")] });
export const smX = c("san-mateo-measure-x", city("San Mateo"));
export const sccA = c("santa-clara-county-measure-a", county("Santa Clara"));
