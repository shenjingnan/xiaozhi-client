import { defineConfig } from "tsup";
import { getVersionDefine } from "../build/version";

export default defineConfig({
  entry: ["./WebServer.ts", "./WebServerLauncher.ts", "./Logger.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "../../dist/backend",
  clean: true,
  sourcemap: true,
  dts: false,
  minify: process.env.NODE_ENV === "production",
  splitting: false,
  bundle: true,
  keepNames: true,
  platform: "node",
  tsconfig: "./tsconfig.json",
  esbuildOptions: (options) => {
    // 在生产环境移除 console 和 debugger
    if (process.env.NODE_ENV === "production") {
      options.drop = ["console", "debugger"];
    }

    options.resolveExtensions = [".ts", ".js", ".json"];

    // 构建时注入版本号常量
    options.define = {
      ...options.define,
      ...getVersionDefine(import.meta.dirname ?? __dirname),
    };
  },
  outExtension() {
    return {
      js: ".js",
    };
  },
  external: [
    // 第三方依赖包（不打包，运行时从 node_modules 加载）
    // 注：Node.js 内置模块（fs, path, http 等）在 platform: "node" 下已被 esbuild 自动排除，无需手动声明
    "ws",
    "dotenv",
    "commander",
    "chalk",
    "ora",
    "express",
    "pino",
    "pino-*",
    "comment-json",
    "dayjs",
    "eventsource",
    "hono",
    "@hono/*",
    "node-cache",
    "jsonc-parser",
    "@coze/api",
    "@modelcontextprotocol/*",
    "prism-media",
    "univoice",
  ],
});
