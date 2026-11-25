import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local Postgres in WASM) must load from node_modules at runtime, not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The dev badge would cover the tab bar inside the phone simulator.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
