import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { defineConfig } from "tsup";

/**
 * 递归复制目录 - 跨平台实现
 */
function copyDirectory(src: string, dest: string, excludePatterns: string[] = []): void {
  // 创建目标目录
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const items = readdirSync(src);

  for (const item of items) {
    // 检查是否应该排除此项
    if (excludePatterns.some((pattern) => item.includes(pattern))) {
      continue;
    }

    const srcPath = join(src, item);
    const destPath = join(dest, item);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath, excludePatterns);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  entry: [
    // 核心可执行文件
    "src/cli.ts",                    // 主 CLI 入口（package.json 的 main 和 bin）
    "src/mcpServerProxy.ts",         // MCP 服务器代理（被 PathUtils 引用）
    "src/WebServerStandalone.ts",    // 独立 Web 服务器（有 shebang）

    // 核心服务
    "src/WebServer.ts",              // Web 服务器核心
    "src/ProxyMCPServer.ts",         // 代理 MCP 服务器
    "src/services/MCPServer.ts",     // MCP 服务器服务
  ],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: true,
  minify: process.env.NODE_ENV === "production",
  splitting: false,
  bundle: true,
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
    "express",
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
        copyDirectory("templates", join(distDir, "templates"));
        console.log("✅ 已复制 templates 目录到 dist/");
      } catch (error) {
        console.warn("⚠️ 复制 templates 目录失败:", error);
      }
    }

    console.log("✅ 构建完成，产物现在为 ESM 格式");
  },
});
