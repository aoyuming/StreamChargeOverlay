import { defineConfig } from "vite";

export default defineConfig({
  appType: "mpa",
  build: {
    outDir: "dist/client",
    rollupOptions: {
      input: {
        display: "display.html",
        admin: "admin.html"
      }
    }
  }
});
