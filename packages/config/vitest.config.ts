import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@xiaozhi-client/mcp-core": resolve(
        __dirname,
        "../../src/mcp-core/index.ts"
      ),
    },
  },
  esbuild: {
    define: {
      // 构建时注入的版本号常量（测试环境使用固定值）
      __VERSION__: JSON.stringify("2.3.0-beta.6"),
      __APP_NAME__: JSON.stringify("xiaozhi-client"),
    },
  },
});
