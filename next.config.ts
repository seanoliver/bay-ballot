import type { NextConfig } from "next";
import { pacificDate } from "./src/lib/election-day";
import { siteShortLinks } from "./src/lib/short-links";

const nextConfig: NextConfig = {
  env: { BUILD_DAY: pacificDate(new Date()) },
  redirects: async () => siteShortLinks(),
  // Also in the layout metadata; the header applies wherever that meta tag ends up.
  headers: async () => [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: "strict-origin" }] }],
};

export default nextConfig;
