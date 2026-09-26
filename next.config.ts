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
  // Vague de correction PR 2 concours, point 1 : la route lit le logo et les
  // polices via process.cwd() (chemins littéraux), que @vercel/nft ne détecte
  // pas tout seul — sans cette inclusion, le PNG casserait en production.
  // Les crochets de `[id]` sont échappés : la clé est un glob (picomatch), pas
  // un chemin de route brut (doc next.config.js `output` → outputFileTracingIncludes).
  outputFileTracingIncludes: {
    "/api/admin/concours/\\[id\\]/qr": ["./public/brand/logo.svg", "./src/fonts/**"],
  },
};

export default nextConfig;
