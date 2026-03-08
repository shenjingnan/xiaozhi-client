/**
 * CLI Vitest 配置
 *
 * 使用共享基础配置，添加 CLI 特定的配置项。
 */

import { resolve } from "node:path";
import { createSharedVitestConfig } from "../../vitest.config.base";

export default createSharedVitestConfig({
  // CLI 特定的覆盖文件范围
  coverageInclude: [resolve(__dirname, "src/**/*.ts")],
  // 定义构建时注入的全局变量，用于测试环境
  defines: {
    __VERSION__: JSON.stringify("1.0.0-test"),
    __APP_NAME__: JSON.stringify("xiaozhi-client"),
  },
  // Backend 路径别名（从 packages/cli 向上到项目根目录）
  resolveAliases: {
    "@handlers": resolve(__dirname, "../../apps/backend/handlers"),
    "@handlers/*": resolve(__dirname, "../../apps/backend/handlers/*"),
    "@services": resolve(__dirname, "../../apps/backend/services"),
    "@services/*": resolve(__dirname, "../../apps/backend/services/*"),
    "@errors": resolve(__dirname, "../../apps/backend/errors"),
    "@errors/*": resolve(__dirname, "../../apps/backend/errors/*"),
    "@utils": resolve(__dirname, "../../apps/backend/utils"),
    "@utils/*": resolve(__dirname, "../../apps/backend/utils/*"),
    "@core": resolve(__dirname, "../../apps/backend/core"),
    "@core/*": resolve(__dirname, "../../apps/backend/core/*"),
    "@transports": resolve(__dirname, "../../apps/backend/lib/mcp/transports"),
    "@transports/*": resolve(
      __dirname,
      "../../apps/backend/lib/mcp/transports/*"
    ),
    "@adapters": resolve(__dirname, "../../apps/backend/adapters"),
    "@adapters/*": resolve(__dirname, "../../apps/backend/adapters/*"),
    "@managers": resolve(__dirname, "../../apps/backend/managers"),
    "@managers/*": resolve(__dirname, "../../apps/backend/managers/*"),
    "@types": resolve(__dirname, "../../apps/backend/types"),
    "@types/*": resolve(__dirname, "../../apps/backend/types/*"),
    "@/lib": resolve(__dirname, "../../apps/backend/lib"),
    "@/lib/*": resolve(__dirname, "../../apps/backend/lib/*"),
    "@": resolve(__dirname, "../../apps/backend"),
    "@/*": resolve(__dirname, "../../apps/backend/*"),
    "@routes": resolve(__dirname, "../../apps/backend/routes"),
    "@routes/*": resolve(__dirname, "../../apps/backend/routes/*"),
    "@constants": resolve(__dirname, "../../apps/backend/constants"),
    "@constants/*": resolve(__dirname, "../../apps/backend/constants/*"),
  },
});
