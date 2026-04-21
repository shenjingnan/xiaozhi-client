/**
 * CLI 构建配置
 *
 * 从 tsup 迁移至 tsdown（基于 Rolldown）
 * 同时使用内置 copy 选项替代 build 链中的内联模板复制脚本
 */

import { createXiaozhiConfig } from "../build/tsdown-base";

export default createXiaozhiConfig({
  entry: {
    index: "index.ts",
  },
  outDir: "../../dist/cli",
  deps: {
    neverBundle: [
      "ws",
      "dotenv",
      "commander",
      "chalk",
      "consola",
      "ora",
      "cli-table3",
      "dayjs",
      "@modelcontextprotocol/sdk",
      "eventsource",
    ],
  },
  // 将项目根目录的 templates/ 复制到输出目录
  // copy 路径相对于 config 文件所在目录（src/cli/）解析
  // to 指向 dist/cli/，tsdown 会保留源目录名 templates，最终生成 dist/cli/templates/
  copy: [{ from: "../../templates", to: "../../dist/cli" }],
});
