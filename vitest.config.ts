import { defineConfig } from "vitest/config";

// Tests unitaires : rapides, sans BDD. Les *.int.test.ts passent par vitest.int.config.ts.
export default defineConfig({
  test: {
    include: ["{apps,packages}/*/src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/*.int.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
