import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests live next to the code they cover, grouped by kind:
//   src/<name>.ts
//   src/tests/unit/<name>.test.ts
//   src/tests/property/<name>.test.ts
//   src/tests/integration/<name>.test.ts
const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/tests/unit/**/*.test.ts"],
          environment: "node"
        }
      },
      {
        resolve: { alias },
        test: {
          name: "property",
          include: ["src/**/tests/property/**/*.test.ts"],
          environment: "node"
        }
      },
      // Integration tests run the plugin through Tailwind's real compiler.
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["src/**/tests/integration/**/*.test.ts"],
          environment: "node"
        }
      }
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["**/tests/**"]
    }
  }
});
