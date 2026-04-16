import { resolve } from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "./dist",
  clean: true,
  sourcemap: true,
  dts: {
    entry: ["src/index.ts"],
    compilerOptions: {
      composite: false,
    },
  },
  bundle: true,
  splitting: false,
  minify: false,
  keepNames: true,
  platform: "node",
  esbuildOptions: (options) => {
    // 在生产环境移除 console 和 debugger
    if (process.env.NODE_ENV === "production") {
      options.drop = ["console", "debugger"];
    }
    options.resolveExtensions = [".ts", ".js", ".json"];

    // shared-types 已迁移到 src/types/，添加 alias 解析
    options.plugins = options.plugins || [];
    options.plugins.push({
      name: "shared-types-alias",
      setup(build) {
        build.onResolve(
          { filter: /^@xiaozhi-client\/shared-types(\/.*)?$/ },
          (args) => {
            const subPath = args.path.replace(
              "@xiaozhi-client/shared-types",
              ""
            );
            if (subPath) {
              return { path: resolve(`../src/types${subPath}/index.ts`) };
            }
            return { path: resolve("../src/types/index.ts") };
          }
        );
      },
    });
  },
  external: [
    // Node.js 内置模块
    "ws",
    "events",
    "node:events",
    "node:fs",
    "node:path",
    "node:url",
    "node:child_process",
    "node:stream",
    "node:http",
    "node:https",
    "node:net",
    "node:crypto",
    // peerDependencies
    "openai",
    "prism-media",
    "univoice",
    "zod",
  ],
  outExtension() {
    return { js: ".js" };
  },
});
