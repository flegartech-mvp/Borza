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
        "components/shell/**/*.tsx",
        "components/ui/**/*.tsx",
        "features/preferences/**/*.{ts,tsx}",
        "features/previews/**/*.{ts,tsx}",
        "features/system-status/**/*.{ts,tsx}",
        "features/workspace/**/*.tsx",
        "lib/class-names.ts",
        "lib/navigation.ts",
        "lib/demo-academy.ts",
        "lib/api-client.ts",
        "lib/runtime-config.ts",
      ],
    },
  },
});
