import path from "path"
import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV !== "production"

// CSP : Next injecte des scripts/styles inline (hydratation), d'où 'unsafe-inline'.
// Les partitions PDF sont affichées dans une iframe de même origine : frame-src/ancestors 'self'.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Évite que Turbopack renomme ces modules (pg-<hash>) : introuvables au runtime en mode standalone
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
  output: "standalone",
  // Monorepo : remonter à la racine pour que le tracing inclut node_modules racine
  outputFileTracingRoot: path.join(__dirname, "../../"),
  experimental: {
    serverActions: {
      allowedOrigins: [],
    },
  },
}

export default nextConfig
