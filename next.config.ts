import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma must not be bundled by Turbopack — otherwise delegates like
  // `prisma.user` can be undefined at runtime ("findUnique" on undefined).
  serverExternalPackages: ["@prisma/client", "prisma"],
  async redirects() {
    return [
      { source: "/assignments", destination: "/tasks", permanent: false },
      {
        source: "/assignments/:path*",
        destination: "/tasks/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
