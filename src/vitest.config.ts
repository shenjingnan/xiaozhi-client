import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  esbuild: {
    define: {
      // 构建时注入的版本号常量（测试环境使用固定值）
      __VERSION__: JSON.stringify("2.3.0-beta.6"),
      __APP_NAME__: JSON.stringify("xiaozhi-client"),
    },
  },
});
