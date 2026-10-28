import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = {
    "/api": {
      target: `http://127.0.0.1:${process.env.PORT || env.PORT || 3001}`,
      changeOrigin: false,
    },
  };
  return {
    esbuild: { jsx: "automatic" },
    server: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
    preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
  };
});
