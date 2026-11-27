import { defineConfig } from "vitest/config";

// Unit tests for pure frontend logic. Browser flows are covered by Playwright (tests/, tests-live/).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: { include: ["src/utils/**/*.ts"], reporter: ["text-summary"] },
  },
});
