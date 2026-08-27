import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    watch: {
      ignored: [
        path.resolve(__dirname, "../server/cache/**"),
        path.resolve(__dirname, "../server/logs"),
        path.resolve(__dirname, "../data/**"),
        path.resolve(__dirname, "../dist/**"),
        path.resolve(__dirname, "../test-results/**"),
        path.resolve(__dirname, "../validation-results-*.json"),
        path.resolve(__dirname, "../response.json"),
      ],
    },
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      "/auth": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
