import { defineConfig } from "vite";

// Tauri 期望固定端口 1420，且使用相对 base 以适配 Android WebView
export default defineConfig({
  root: "src",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0",
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2021",
    minify: "esbuild",
  },
  base: "./",
});
