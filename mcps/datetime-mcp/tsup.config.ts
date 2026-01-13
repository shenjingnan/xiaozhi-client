import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  bundle: true,
  platform: "node",
  minify: process.env.NODE_ENV === "production",
  // 保持 shebang
  esbuildOptions: (options) => {
    options.banner = {
      js: "#!/usr/bin/env node",
    };
  },
});
