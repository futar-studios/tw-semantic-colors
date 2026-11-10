import analyzer from "rollup-plugin-analyzer";
import { fileURLToPath, URL } from "url";
import dts from "unplugin-dts/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [dts({ bundleTypes: true, copyDtsFiles: true })],
  build: {
    lib: {
      // Two entry points, so formats are ES and CJS only (UMD cannot hold several)
      entry: { lib: "./src/lib.ts", theme: "./src/theme-plugin.ts" },
      formats: ["es", "cjs"],
      fileName: (format, name) => `${name}.${format === "es" ? "js" : "cjs"}`
    },
    minify: true,
    rollupOptions: {
      // Make sure to externalize deps that shouldn't be bundled into the library
      external: ["tailwindcss/plugin", "node:fs", "node:path"],
      output: { minify: true },
      plugins: [analyzer({ summaryOnly: true })]
    },
    sourcemap: true
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
