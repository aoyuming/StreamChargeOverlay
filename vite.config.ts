import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  appType: "mpa",
  build: {
    outDir: "dist/client",
    rollupOptions: {
      input: {
        display: resolve(projectRoot, "display.html"),
        admin: resolve(projectRoot, "admin.html")
      }
    }
  }
});
