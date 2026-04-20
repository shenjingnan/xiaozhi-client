import { createXiaozhiConfig } from "../build/tsup-base";

export default createXiaozhiConfig({
  entry: {
    index: "index.ts",
  },
  outDir: "../../dist/cli",
  external: [
    "ws",
    "dotenv",
    "commander",
    "chalk",
    "consola",
    "ora",
    "cli-table3",
    "comment-json",
    "dayjs",
    "@modelcontextprotocol/sdk",
    "eventsource",
  ],
});
