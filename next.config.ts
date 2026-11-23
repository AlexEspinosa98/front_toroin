import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La insignia de desarrollo de Next tapaba la navegación inferior en celular (solo existe en `next dev`)
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
