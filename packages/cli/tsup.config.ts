import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsup";

// 读取根目录 package.json 获取版本号
const rootPkgPath = resolve("../../package.json");
let pkg: { version: string; name: string };
try {
  pkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));
} catch (error) {
  throw new Error(
    `无法解析根目录 package.json 文件: ${rootPkgPath}\n` +
      `错误: ${error instanceof Error ? error.message : String(error)}`
  );
}

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

    let cliPkg: { version: string };
    let rootPkg: { version: string };
    try {
      cliPkg = JSON.parse(readFileSync(cliPkgPath, "utf-8"));
      rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));
    } catch (error) {
      throw new Error(
        `无法解析 package.json 文件\nCLI: ${cliPkgPath}\nRoot: ${rootPkgPath}\n错误: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (cliPkg.version !== rootPkg.version) {
      rootPkg.version = cliPkg.version;
      writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`);
      console.log(`✅ 已同步根 package.json 版本到 ${cliPkg.version}`);
    }
  },
});
