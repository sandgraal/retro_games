import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  // Use relative paths for GitHub Pages compatibility
  base: "/retro-games/",
  publicDir: "public",

  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: "esbuild",
    target: "es2022",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        privacy: resolve(__dirname, "privacy-faq.html"),
      },
    },
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@/core": resolve(__dirname, "src/core"),
      "@/data": resolve(__dirname, "src/data"),
      "@/ui": resolve(__dirname, "src/ui"),
      "@/state": resolve(__dirname, "src/state"),
    },
  },

  server: {
    port: 3000,
    open: false,
    cors: true,
  },

  preview: {
    port: 4173,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  },
});
