import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { defineConfig } from "tsup";
import { getVersionDefine } from "../build/version";

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
  entry: ["./WebServer.ts", "./WebServerLauncher.ts", "./Logger.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "../../dist/backend",
  clean: true,
  sourcemap: true,
  dts: false,
  minify: process.env.NODE_ENV === "production",
  splitting: false,
  bundle: true,
  keepNames: true,
  platform: "node",
  tsconfig: "./tsconfig.json",
  esbuildOptions: (options) => {
    // 在生产环境移除 console 和 debugger
    if (process.env.NODE_ENV === "production") {
      options.drop = ["console", "debugger"];
    }

    options.resolveExtensions = [".ts", ".js", ".json"];

    // 构建时注入版本号常量
    options.define = {
      ...options.define,
      ...getVersionDefine(import.meta.dirname ?? __dirname),
    };

    // 注入 require polyfill：让打包的 CJS 依赖中的 require() 在 ESM 环境下正常工作
    options.banner = {
      js: [
        "import { createRequire } from 'node:module';",
        "const require = createRequire(import.meta.url);",
        "var __require = require;",
      ].join("\n"),
    };
  },
  outExtension() {
    return {
      js: ".js",
    };
  },
  external: [
    // 第三方依赖包（不打包，运行时从 node_modules 加载）
    // 注：Node.js 内置模块（fs, path, http 等）在 platform: "node" 下已被 esbuild 自动排除，无需手动声明
    "ws",
    "dotenv",
    "commander",
    "chalk",
    "ora",
    "express",
    "pino",
    "pino-*",
    "comment-json",
    "dayjs",
    "eventsource",
    "hono",
    "@hono/*",
    "node-cache",
    "jsonc-parser",
    "@coze/api",
    "@modelcontextprotocol/*",
    "prism-media",
    "univoice",
  ],
  onSuccess: async () => {
    // 复制配置文件到 dist/backend
    const distDir = "../../dist/backend";

    // 确保 dist/backend 目录存在
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }

    // 复制 xiaozhi.config.default.json
    if (existsSync("../../xiaozhi.config.default.json")) {
      copyFileSync(
        "../../xiaozhi.config.default.json",
        join(distDir, "xiaozhi.config.default.json")
      );
      console.log("✅ 已复制 xiaozhi.config.default.json 到 dist/backend/");
    }

    // 复制 package.json 到 dist/backend 目录，以便运行时能读取版本号
    if (existsSync("../../package.json")) {
      copyFileSync("../../package.json", join(distDir, "package.json"));
      console.log("✅ 已复制 package.json 到 dist/backend/");
    }

    // 复制 templates 目录到 dist/backend 目录
    if (existsSync("../../templates")) {
      try {
        copyDirectory("../../templates", join(distDir, "templates"));
        console.log("✅ 已复制 templates 目录到 dist/backend/");
      } catch (error) {
        console.warn("⚠️ 复制 templates 目录失败:", error);
      }
    }

    console.log("✅ 构建完成，产物现在为 ESM 格式");
  },
});
