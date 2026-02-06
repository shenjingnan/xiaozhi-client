import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { defineConfig } from "tsup";

/**
 * 递归复制目录 - 跨平台实现
 */
function copyDirectory(
  src: string,
  dest: string,
  excludePatterns: string[] = []
): void {
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
    "apps/backend/WebServer.ts",
    "apps/backend/WebServerLauncher.ts",
    "apps/backend/Logger.ts",
  ],
  format: ["esm"],
  target: "node18",
  outDir: "dist/backend",
  clean: true,
  sourcemap: true,
  dts: false, // 禁用 DTS 以避免类型错误
  minify: process.env.NODE_ENV === "production",
  splitting: false,
  bundle: true,
  keepNames: true,
  platform: "node",
  tsconfig: "apps/backend/tsconfig.json",
  esbuildOptions: (options) => {
    // 在生产环境移除 console 和 debugger
    if (process.env.NODE_ENV === "production") {
      options.drop = ["console", "debugger"];
    }

    // 添加路径别名支持
    options.resolveExtensions = [".ts", ".js", ".json"];

    // 确保能够解析路径别名
    if (!options.external) {
      options.external = [];
    }
  },
  outExtension() {
    return {
      js: ".js",
    };
  },
  external: [
    // Node.js 内置模块
    "ws",
    "child_process",
    "fs",
    "path",
    "url",
    "process",
    "dotenv",
    "os",
    "stream",
    "events",
    "util",
    "crypto",
    "http",
    "https",
    // 外部依赖包
    "commander",
    "chalk",
    "ora",
    "express",
    "pino",
    "pino-*",
    "zod",
    "comment-json",
    "dayjs",
    "ajv",
    "eventsource",
    "hono",
    "@hono/*",
    "node-cache",
    "jsonc-parser",
    "ws",
    "@coze/api",
    "@modelcontextprotocol/*",
    // @xiaozhi-client 内部包（运行时从 dist 读取）
    "@xiaozhi-client/config",
    "@xiaozhi-client/config.js",
    "@xiaozhi-client/endpoint",
    "@xiaozhi-client/mcp-core",
    "@xiaozhi-client/shared-types",
  ],
  onSuccess: async () => {
    // 复制配置文件到 dist/backend
    const distDir = "dist/backend";

    // 确保 dist/backend 目录存在
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }

    // 复制 xiaozhi.config.default.json
    if (existsSync("xiaozhi.config.default.json")) {
      copyFileSync(
        "xiaozhi.config.default.json",
        join(distDir, "xiaozhi.config.default.json")
      );
      console.log("✅ 已复制 xiaozhi.config.default.json 到 dist/backend/");
    }

    // 复制 package.json 到 dist/backend 目录，以便运行时能读取版本号
    if (existsSync("package.json")) {
      copyFileSync("package.json", join(distDir, "package.json"));
      console.log("✅ 已复制 package.json 到 dist/backend/");
    }

    // 复制 templates 目录到 dist/backend 目录
    if (existsSync("templates")) {
      try {
        copyDirectory("templates", join(distDir, "templates"));
        console.log("✅ 已复制 templates 目录到 dist/backend/");
      } catch (error) {
        console.warn("⚠️ 复制 templates 目录失败:", error);
      }
    }

    console.log("✅ 构建完成，产物现在为 ESM 格式");

    // 创建向后兼容的 dist/WebServerLauncher.js
    const compatLauncherPath = "dist/WebServerLauncher.js";
    writeFileSync(
      compatLauncherPath,
      `// 向后兼容包装脚本 - 重定向到新的路径
export * from './backend/WebServerLauncher.js';
`
    );
    console.log("✅ 已创建向后兼容包装脚本 dist/WebServerLauncher.js");
  },
});
