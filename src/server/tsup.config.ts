import { createXiaozhiConfig } from "../build/tsup-base";

export default createXiaozhiConfig({
  entry: ["./WebServer.ts", "./WebServerLauncher.ts", "./Logger.ts"],
  outDir: "../../dist/backend",
  tsconfig: "./tsconfig.json",
  external: [
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
});
