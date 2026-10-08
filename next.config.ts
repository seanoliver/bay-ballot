import type { NextConfig } from "next";
import { siteShortLinks } from "./src/lib/short-links";

const nextConfig: NextConfig = {
  redirects: async () => siteShortLinks(),
};

export default nextConfig;
