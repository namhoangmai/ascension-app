import "dotenv/config";

import { defineConfig, env } from "prisma/config";

type Env = {
  DATABASE_URL: string;
  DIRECT_URL: string;
};

export default defineConfig({
  engine: "classic",
  schema: "prisma/schema.prisma",
  datasource: {
    url: env<Env>("DATABASE_URL"),
    directUrl: env<Env>("DIRECT_URL"),
  },
});
