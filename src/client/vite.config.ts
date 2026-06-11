import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import crypto from "crypto";

function swBuildHashPlugin() {
  return {
    name: "sw-build-hash",
    writeBundle(options: { dir?: string }) {
      const dir = options.dir || path.resolve(__dirname, "dist");
      const swPath = path.resolve(dir, "sw.js");
      if (!fs.existsSync(swPath)) return;
      const hash = crypto.createHash("md5").update(Date.now().toString()).digest("hex").slice(0, 8);
      const content = fs.readFileSync(swPath, "utf-8");
      fs.writeFileSync(swPath, content.replace("__BUILD_HASH__", hash));
    },
  };
}

export default defineConfig({
  plugins: [react(), swBuildHashPlugin()],
  root: path.resolve(__dirname),
  publicDir: path.resolve(__dirname, "public"),
  resolve: {
    alias: {
      "@client": path.resolve(__dirname),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
