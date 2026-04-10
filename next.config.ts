import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma must not be bundled by Turbopack — otherwise delegates like
  // `prisma.user` can be undefined at runtime ("findUnique" on undefined).
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
