import { defineConfig } from "tsup";
import { baseConfig } from "../../tsup.base.config";

export default defineConfig({
  ...baseConfig,
  external: [
    // Node.js 内置模块
    "ws",
    "events",
    "node:events",
    // 外部依赖（peer dependencies）
    "@modelcontextprotocol/sdk",
    // 工作区依赖
    "@xiaozhi-client/config",
    "@xiaozhi-client/mcp-core",
  ],
});
