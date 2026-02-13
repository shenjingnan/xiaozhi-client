/**
 * tsup 基础配置
 *
 * 为项目中的包提供共享的构建配置，遵循 DRY 原则。
 * 各个包可以根据需要扩展此基础配置，主要差异在于 external 依赖。
 */

import { defineConfig } from "tsup";

/**
 * 基础配置对象
 *
 * 包含所有包共享的构建选项：
 * - ESM 格式输出
 * - Node.js 18 目标
 * - 源映射支持
 * - TypeScript 声明文件生成
 * - 生产环境自动移除 console 和 debugger
 */
export const baseConfig = defineConfig({
  /** 入口文件 */
  entry: ["src/index.ts"],

  /** 输出格式 */
  format: ["esm"],

  /** 编译目标 */
  target: "node18",

  /** 输出目录 */
  outDir: "./dist",

  /** 构建前清理输出目录 */
  clean: true,

  /** 生成源映射 */
  sourcemap: true,

  /** TypeScript 声明文件配置 */
  dts: {
    entry: ["src/index.ts"],
    compilerOptions: {
      composite: false,
    },
  },

  /** 打包所有依赖 */
  bundle: true,

  /** 禁用代码分割 */
  splitting: false,

  /** 不压缩代码 */
  minify: false,

  /** 保留函数和类名称 */
  keepNames: true,

  /** 运行平台 */
  platform: "node",

  /** esbuild 选项 */
  esbuildOptions: (options) => {
    // 在生产环境移除 console 和 debugger
    if (process.env.NODE_ENV === "production") {
      options.drop = ["console", "debugger"];
    }
    // 模块解析扩展名
    options.resolveExtensions = [".ts", ".js", ".json"];
  },

  /** 输出文件扩展名 */
  outExtension() {
    return { js: ".js" };
  },
});
