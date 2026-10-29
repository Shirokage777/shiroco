import type { NextConfig } from "next";

// Every response tells search engines to stay out (privacy requirement).
export const robotsHeader = { key: "X-Robots-Tag", value: "noindex, nofollow" };

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [robotsHeader] }];
  },
};

export default nextConfig;
