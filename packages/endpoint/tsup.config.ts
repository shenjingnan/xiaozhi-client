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

    // mcp-core 已迁移到 src/mcp-core/，添加 alias 解析
    options.plugins = options.plugins || [];
    options.plugins.push({
      name: "mcp-core-alias",
      setup(build) {
        build.onResolve(
          { filter: /^@xiaozhi-client\/mcp-core(\/.*)?$/ },
          (args) => {
            const subPath = args.path.replace("@xiaozhi-client/mcp-core", "");
            if (subPath) {
              return {
                path: resolve(`../../src/mcp-core${subPath}.ts`),
              };
            }
            return {
              path: resolve("../../src/mcp-core/index.ts"),
            };
          }
        );
      },
    });

    // config 已迁移到 src/config/，添加 alias 解析
    options.plugins.push({
      name: "config-alias",
      setup(build) {
        build.onResolve(
          { filter: /^@xiaozhi-client\/config(\/.*)?$/ },
          (args) => {
            const subPath = args.path.replace("@xiaozhi-client/config", "");
            if (subPath) {
              return {
                path: resolve(`../../src/config${subPath}.ts`),
              };
            }
            return {
              path: resolve("../../src/config/index.ts"),
            };
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
    // 外部依赖（peer dependencies）
    "@modelcontextprotocol/sdk",
    // 工作区依赖（config 已迁移到 src/config/，通过 alias 解析）
    "@xiaozhi-client/mcp-core",
  ],
  outExtension() {
    return { js: ".js" };
  },
});
