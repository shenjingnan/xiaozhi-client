/**
 * tsup 共享基础配置
 *
 * 为 CLI 和 Server 构建目标提供统一的配置基线，
 * 避免两份配置文件中的重复代码和潜在的不一致。
 */

import { type Options, defineConfig } from "tsup";
import { getVersionDefine } from "./version";

/**
 * 创建 xiaozhi 项目通用的 tsup 配置
 *
 * @param overrides - 各构建目标特有的配置（entry、outDir、external、tsconfig）
 * @returns 完整的 tsup 配置对象
 */
export function createXiaozhiConfig(
  overrides: Pick<Options, "entry" | "outDir" | "external" | "tsconfig">
) {
  return defineConfig({
    format: ["esm"],
    target: "node22",
    platform: "node",
    bundle: true,
    outExtension: () => ({ js: ".js" }),
    clean: true,
    sourcemap: true,
    minify: process.env.NODE_ENV === "production",
    splitting: false,
    keepNames: true,
    ...overrides,
    esbuildOptions: (options) => {
      // 在生产环境移除 console 和 debugger
      if (process.env.NODE_ENV === "production") {
        options.drop = ["console", "debugger"];
      }

      // 注入 require polyfill：ESM 环境中没有全局 require，
      // 但 cross-spawn 等 CJS 依赖需要它
      options.banner = {
        js: [
          "import { createRequire } from 'node:module';",
          "globalThis.require = createRequire(import.meta.url);",
          "",
        ].join("\n"),
      };

      // 构建时注入版本号常量
      options.define = {
        ...options.define,
        ...getVersionDefine(import.meta.dirname),
      };
    },
  });
}
