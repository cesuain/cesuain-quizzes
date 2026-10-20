import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Quiz JSON files are read from disk at runtime by the API route.
  outputFileTracingIncludes: { "/api/quizzes/**": ["./data/quizzes/**/*"] },
};

export default nextConfig;
