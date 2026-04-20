import { defineConfig } from "tsup";
import { getVersionDefine } from "../build/version";

export default defineConfig({
  entry: {
    index: "index.ts",
  },
  format: ["esm"],
  target: "node22",
  outDir: "../../dist/cli",
  clean: true,
  sourcemap: true,
  dts: false,
  minify: process.env.NODE_ENV === "production",
  splitting: false,
  bundle: true,
  keepNames: true,
  platform: "node",
  esbuildOptions: (options) => {
    options.resolveExtensions = [".ts", ".js", ".json"];

    // 在生产环境移除 console 和 debugger
    if (process.env.NODE_ENV === "production") {
      options.drop = ["console", "debugger"];
    }

    // 构建时注入版本号常量
    options.define = {
      ...options.define,
      ...getVersionDefine(import.meta.dirname ?? __dirname),
    };
  },
  external: [
    // 第三方依赖包（不打包，运行时从 node_modules 加载）
    // 注：Node.js 内置模块在 platform: "node" 下已被 esbuild 自动排除，无需手动声明
    "ws",
    "dotenv",
    "commander",
    "chalk",
    "consola",
    "ora",
    "express",
    "cli-table3",
    // src/config/ 依赖的第三方包
    "comment-json",
    "core-util-is",
    "dayjs",
    // src/mcp-core/ 依赖的第三方包
    "@modelcontextprotocol/sdk",
    "eventsource",
  ],
  outExtension: () => ({
    js: ".js",
  }),
});
