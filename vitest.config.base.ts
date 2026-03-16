/**
 * Vitest 共享配置基础
 *
 * 提供可复用的 Vitest 配置，避免在多个包中重复相同的配置代码。
 * 各个包可以通过扩展此配置来添加特定的配置项。
 */

import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { UserConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// ESM 兼容的 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 共享测试配置选项
 */
export interface SharedVitestOptions {
  /** 额外的排除模式 */
  additionalExcludes?: string[];
  /** 额外的包含模式 */
  additionalIncludes?: string[];
  /** 覆盖率包含的文件模式 */
  coverageInclude?: string[];
  /** 覆盖率排除的文件模式 */
  coverageExcludes?: string[];
  /** 定义的全局变量 */
  defines?: Record<string, string>;
  /** 路径别名配置 */
  resolveAliases?: Record<string, string>;
  /** 额外的插件 */
  additionalPlugins?: UserConfig["plugins"];
}

/**
 * 创建 Vitest 共享配置
 *
 * @param options - 配置选项
 * @returns Vitest 配置对象
 */
export function createSharedVitestConfig(options: SharedVitestOptions = {}) {
  const {
    additionalExcludes = [],
    additionalIncludes = [],
    coverageInclude = [resolve(__dirname, "**/*.ts")],
    coverageExcludes = [],
    defines,
    resolveAliases,
    additionalPlugins = [],
  } = options;

  return defineConfig({
    plugins: [
      // 添加 tsconfig 路径解析插件
      tsconfigPaths(),
      ...additionalPlugins,
    ],
    define: defines,
    test: {
      globals: true,
      environment: "node",
      testTimeout: 10000, // 减少默认测试超时时间
      hookTimeout: 10000, // 减少默认 hook 超时时间
      include: [
        "**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
        ...additionalIncludes,
      ],
      exclude: ["**/node_modules", "dist", ...additionalExcludes],
      // 分组配置，将超时测试分离
      // 超时测试：包含"timeout"字样的测试文件
      // 普通测试：其他所有测试
      coverage: {
        enabled: true,
        provider: "v8",
        reporter: ["text", "json", "html", "lcov"],
        reportsDirectory: resolve(__dirname, "coverage"),
        exclude: [
          "node_modules/**",
          "dist/**",
          "**/*.d.ts",
          "**/*.config.{js,ts}",
          "coverage/**",
          ...coverageExcludes,
        ],
        include: coverageInclude,
        all: true,
        thresholds: {
          global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
          },
        },
      },
    },
    resolve: {
      alias: resolveAliases,
    },
  });
}
