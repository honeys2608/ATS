import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_BASE_URL || "http://localhost:8000";

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: ["127.0.0.1", "localhost"],
      proxy: {
        "/auth": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        "/v1": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
    },
    resolve: {
      alias: {
        "@assets": "/src/assets",
      },
    },
  };
});
