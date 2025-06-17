import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/mcpPipe.ts",
    "src/mcpServerProxy.ts",
    "src/cli.ts",
    "src/configManager.ts",
    "src/mcpCommands.ts",
    "src/autoCompletion.ts",
  ],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: true,
  minify: true,
  splitting: false,
  bundle: false,
  keepNames: true,
  platform: "node",
  outExtension() {
    return {
      js: ".js",
    };
  },
  external: [
    "ws",
    "child_process",
    "fs",
    "path",
    "url",
    "process",
    "dotenv",
    "commander",
    "chalk",
    "ora",
  ],
  onSuccess: async () => {
    // 复制配置文件到 dist
    const distDir = "dist";

    // 确保 dist 目录存在
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }

    // 复制 xiaozhi.config.default.json
    if (existsSync("xiaozhi.config.default.json")) {
      copyFileSync(
        "xiaozhi.config.default.json",
        join(distDir, "xiaozhi.config.default.json")
      );
      console.log("✅ 已复制 xiaozhi.config.default.json 到 dist/");
    }

    // 复制 package.json 到 dist 目录，以便运行时能读取版本号
    if (existsSync("package.json")) {
      copyFileSync("package.json", join(distDir, "package.json"));
      console.log("✅ 已复制 package.json 到 dist/");
    }

    // 复制 templates 目录到 dist 目录
    if (existsSync("templates")) {
      try {
        execSync(`cp -r templates ${distDir}/`, { stdio: "inherit" });
        console.log("✅ 已复制 templates 目录到 dist/");
      } catch (error) {
        console.warn("⚠️ 复制 templates 目录失败:", error);
      }
    }

    console.log("✅ 构建完成，产物现在为 ESM 格式");
  },
});
