import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  esbuild: {
    define: {
      __VERSION__: JSON.stringify("1.9.7"),
      __APP_NAME__: JSON.stringify("xiaozhi-client"),
    },
  },
});
