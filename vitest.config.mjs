import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@/core": resolve(__dirname, "src/core"),
      "@/data": resolve(__dirname, "src/data"),
      "@/ui": resolve(__dirname, "src/ui"),
      "@/state": resolve(__dirname, "src/state"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.js", "tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/**/*.js", "src/**/*.ts"],
      exclude: ["app/main.js", "src/main.ts"],
    },
  },
});
