import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

// 获取当前文件所在目录（ESM 环境下获取 __dirname 的方式）
const __dirname = dirname(fileURLToPath(import.meta.url));

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

// 读取根目录 package.json 获取版本号
const rootPkgPath = resolve("../../package.json");
const pkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["esm"],
  target: "node18",
  outDir: "../../dist/cli",
  clean: true,
  sourcemap: true,
  dts: false,
  minify: process.env.NODE_ENV === "production",
  splitting: false,
  bundle: true,
  keepNames: true,
  platform: "node",
  esbuildOptions: (options) => {
    options.resolveExtensions = [".ts", ".js", ".json"];

    // 在生产环境移除 console 和 debugger
    if (process.env.NODE_ENV === "production") {
      options.drop = ["console", "debugger"];
    }

    // 构建时注入版本号常量
    options.define = {
      ...options.define, // 保留已有的 define
      __VERSION__: JSON.stringify(pkg.version),
      __APP_NAME__: JSON.stringify(pkg.name),
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
    // 依赖的外部包（不打包）
    "commander",
    "chalk",
    "consola",
    "ora",
    "express",
    "cli-table3",
    // @xiaozhi-client/config 包（运行时从 dist/config 读取）
    "@xiaozhi-client/config",
    "@xiaozhi-client/config.js",
    // @xiaozhi-client/version 包（运行时从 dist/version 读取）
    "@xiaozhi-client/version",
    "@xiaozhi-client/version.js",
    // Backend 模块（运行时从 dist/backend 读取）
    "@/WebServer",
    "@/WebServer.js",
  ],
  outExtension: () => ({
    js: ".js",
  }),
  onSuccess: async () => {
    // 构建后处理：修复导入路径
    const filePath = resolve("../../dist/cli/index.js");
    let content = readFileSync(filePath, "utf-8");

    // 替换 @/* 为指向正确位置的相对路径
    // 注意：@xiaozhi-client/config 现在从 node_modules 解析，不需要替换
    content = content
      .replace(
        /from\s*["']@\/WebServer\.js["']/g,
        'from "../backend/WebServer.js"'
      )
      .replace(/from\s*["']@\/WebServer["']/g, 'from "../backend/WebServer.js"')
      // 替换动态导入中的 @/WebServer.js
      .replace(
        /import\(["']@\/WebServer\.js["']\)/g,
        'import("../backend/WebServer.js")'
      )
      .replace(
        /import\(["']@\/WebServer["']\)/g,
        'import("../backend/WebServer.js")'
      );

    writeFileSync(filePath, content);
    console.log("✅ 已修复 dist/cli/index.js 中的导入路径");

    // 同步根 package.json 版本到与 CLI 包一致
    const cliPkgPath = resolve("../../packages/cli/package.json");
    const rootPkgPath = resolve("../../package.json");

    const cliPkg = JSON.parse(readFileSync(cliPkgPath, "utf-8"));
    const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));

    if (cliPkg.version !== rootPkg.version) {
      rootPkg.version = cliPkg.version;
      writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`);
      console.log(`✅ 已同步根 package.json 版本到 ${cliPkg.version}`);
    }

    // 复制根目录 templates 到 dist/templates 目录
    const templatesPath = resolve("../../templates");
    const distTemplatesPath = resolve("../../dist/templates");
    if (existsSync(templatesPath)) {
      try {
        copyDirectory(templatesPath, distTemplatesPath);
        console.log("✅ 已复制 templates 目录到 dist/templates/");
      } catch (error) {
        console.warn("⚠️ 复制 templates 目录失败:", error);
      }
    } else {
      console.warn("⚠️ 根目录 templates 目录不存在，跳过复制");
    }
  },
});
