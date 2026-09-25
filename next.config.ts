import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Concours (spec 2026-09-25 §5) : ceinture en plus de la balise meta, pour
  // que même une réponse non-HTML ou une erreur porte l'interdiction d'indexer.
  async headers() {
    return [
      { source: "/concours/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
