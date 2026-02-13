import { defineConfig } from "tsup";
import { baseConfig } from "../../tsup.base.config";

export default defineConfig({
  ...baseConfig,
  external: [
    // Node.js 内置模块
    "ws",
    "eventsource",
    "events",
    "node:events",
    "node:fs",
    "node:path",
    "node:url",
    "node:child_process",
    "node:stream",
    "node:http",
    "node:https",
    "node:net",
    // 外部依赖（peer dependencies）
    "@modelcontextprotocol/sdk",
  ],
});
