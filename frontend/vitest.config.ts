import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    setupFiles: ["./test/setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      include: [
        "components/ui/**/*.tsx",
        "features/review/review-scheduler.ts",
        "features/simulator/engine.ts",
        "features/tools/calculators.ts",
        "features/practical-finance/engine.ts",
      ],
    },
  },
});
