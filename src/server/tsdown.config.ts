/**
 * Server 构建配置
 *
 * 从 tsup 迁移至 tsdown（基于 Rolldown）
 */

import { createXiaozhiConfig } from "../build/tsdown-base";

export default createXiaozhiConfig({
  entry: ["./WebServer.ts", "./WebServerLauncher.ts", "./Logger.ts"],
  outDir: "../../dist/backend",
  tsconfig: "./tsconfig.json",
  deps: {
    neverBundle: [
      "ws",
      "dotenv",
      "chalk",
      "pino",
      "pino-*",
      "comment-json",
      "dayjs",
      "eventsource",
      "hono",
      "@hono/*",
      "node-cache",
      "@coze/api",
      "prism-media",
      "univoice",
    ],
  },
});
