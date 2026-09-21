import withPWA from "next-pwa";

const isProduction = process.env.NODE_ENV === "production";

// CSP notes:
// - script-src keeps 'unsafe-inline' because Next.js injects inline bootstrap/flight scripts
//   and the theme-init script in src/app/layout.tsx is inline. Moving to nonces would require
//   per-request middleware nonces and force every page to render dynamically; that is a
//   follow-up decision. Every other directive is locked down.
// - 'unsafe-eval' is only added in development (React refresh / source maps).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.openfoodfacts.org",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction ? ["upgrade-insecure-requests"] : [])
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : [])
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.openfoodfacts.org"
      }
    ]
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

// Service worker caches static build assets only. next-pwa's default runtimeCaching would
// also cache same-origin pages, RSC payloads and GET /api/* responses (authenticated data),
// so it is replaced. Anything not matched here goes straight to the network.
const staticAssetCaching = [
  {
    urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
    handler: "CacheFirst",
    options: {
      cacheName: "next-static-assets",
      expiration: { maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 }
    }
  },
  {
    urlPattern: ({ url, sameOrigin }) =>
      sameOrigin && /^\/icons\/.*\.(?:png|svg|ico|webp)$/i.test(url.pathname),
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "static-icons",
      expiration: { maxEntries: 32, maxAgeSeconds: 7 * 24 * 60 * 60 }
    }
  }
];

export default withPWA({
  dest: "public",
  sw: "sw-production.js",
  disable: !isProduction,
  register: true,
  skipWaiting: true,
  dynamicStartUrl: false,
  cacheOnFrontEndNav: false,
  runtimeCaching: staticAssetCaching
})(nextConfig);
