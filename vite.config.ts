import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  base: "./",
  plugins: [preact()],
  publicDir: false,
  build: { target: "es2022", chunkSizeWarningLimit: 2000 },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
} as never);
