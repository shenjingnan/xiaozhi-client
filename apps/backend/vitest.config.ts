/**
 * Apps Backend Vitest 配置
 *
 * 使用共享基础配置，添加 backend 特定的配置项。
 */

import { resolve } from "node:path";
import { createSharedVitestConfig } from "../../vitest.config.base";

export default createSharedVitestConfig({
  // Backend 特定的排除目录
  additionalExcludes: ["templates/**/*"],
  // 覆盖率包含的文件
  coverageInclude: [resolve(__dirname, "**/*.ts")],
  // 覆盖率排除的文件
  coverageExcludes: ["templates/**"],
});
