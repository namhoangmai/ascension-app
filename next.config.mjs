import withPWA from "next-pwa";

const isProduction = process.env.NODE_ENV === "production";

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
  }
};

export default withPWA({
  dest: "public",
  sw: "sw-production.js",
  disable: !isProduction,
  register: true,
  skipWaiting: true
})(nextConfig);
