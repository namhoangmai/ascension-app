import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Hermetic: no .env is loaded; every secret the code reads is set here.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      AUTH_SECRET: "test-auth-secret-not-for-production"
    },
    server: {
      deps: {
        inline: ["next-auth"]
      }
    }
  }
});
