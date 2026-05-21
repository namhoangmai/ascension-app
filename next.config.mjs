import withPWA from "next-pwa";

const isDev = process.env.NODE_ENV === "development";

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
  disable: isDev,
  register: true,
  skipWaiting: true
})(nextConfig);
