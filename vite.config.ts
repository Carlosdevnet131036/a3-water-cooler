import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: "es2020", outDir: "dist", assetsInlineLimit: 100_000_000 },
});
