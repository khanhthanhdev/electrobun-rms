import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src/mainview"),
      "@/app": path.resolve(import.meta.dirname, "src/mainview/app"),
      "@/features": path.resolve(import.meta.dirname, "src/mainview/features"),
      "@/pages": path.resolve(import.meta.dirname, "src/mainview/pages"),
      "@/shared": path.resolve(import.meta.dirname, "src/mainview/shared"),
      "@/widgets": path.resolve(import.meta.dirname, "src/mainview/widgets"),
    },
  },
  css: {
    transformer: "lightningcss",
    lightningcss: {
      // Electrobun embeds a modern Chromium-based renderer.
      // Encode version as major << 16 | minor << 8 | patch (Chrome 100)
      targets: { chrome: 100 },
      // Enable draft CSS features (e.g. custom media queries)
      drafts: {
        customMedia: true,
      },
    },
  },
  root: "src/mainview",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id): string | undefined => {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.includes("scheduler")
          ) {
            return "vendor-react";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
