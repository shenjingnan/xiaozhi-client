/**
 * tsdown 共享基础配置
 *
 * 为 CLI 和 Server 构建目标提供统一的配置基线，
 * 避免两份配置文件中的重复代码和潜在的不一致。
 */

import { type UserConfig, defineConfig } from "tsdown";
import { getVersionDefine } from "./version";

/**
 * 创建 xiaozhi 项目通用的 tsdown 配置
 *
 * @param overrides - 各构建目标特有的配置（entry、outDir、deps、tsconfig、copy）
 * @returns 完整的 tsdown 配置对象
 */
export function createXiaozhiConfig(overrides: {
  entry: UserConfig["entry"];
  outDir: string;
  deps?: UserConfig["deps"];
  tsconfig?: string;
  copy?: UserConfig["copy"];
}) {
  return defineConfig({
    // ---- 输出格式与平台 ----
    format: ["esm"],
    target: "node22",
    platform: "node",

    // ---- 输出控制 ----
    clean: true,
    sourcemap: true,
    fixedExtension: false,
    outExtensions: () => ({ js: ".js" }),

    // ---- 压缩配置 ----
    minify:
      process.env.NODE_ENV === "production"
        ? {
            compress: {
              dropConsole: true,
              dropDebugger: true,
            },
          }
        : false,

    // ---- require polyfill（ESM 环境兼容 CJS 依赖）----
    banner: [
      "import { createRequire } from 'node:module';",
      "globalThis.require = createRequire(import.meta.url);",
      "",
    ].join("\n"),

    // ---- 构建时版本号常量注入 ----
    define: getVersionDefine(import.meta.dirname),

    // ---- 保留函数/类 name 属性（调试和框架注册需要）----
    outputOptions(options) {
      options.keepNames = true;
    },

    // ---- 合并各构建目标特有配置 ----
    ...overrides,
  });
}
