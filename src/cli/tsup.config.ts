import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsup";

// 读取根目录 package.json 获取版本号
const rootPkgPath = resolve("../../package.json");
const pkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));

export default defineConfig({
  entry: {
    index: "index.ts",
  },
  format: ["esm"],
  target: "node22",
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

    // version 已迁移到 src/utils/version.ts，添加 alias 解析
    options.plugins = options.plugins || [];
    options.plugins.push({
      name: "version-alias",
      setup(build) {
        build.onResolve(
          { filter: /^@xiaozhi-client\/version(\/.*)?$/ },
          () => ({
            path: resolve("../../utils/version.ts"),
          })
        );
      },
    });

    // config 已迁移到 src/config/，添加 alias 解析
    options.plugins.push({
      name: "config-alias",
      setup(build) {
        build.onResolve(
          { filter: /^@xiaozhi-client\/config(\/.*)?$/ },
          (args) => {
            const subPath = args.path.replace("@xiaozhi-client/config", "");
            if (subPath) {
              // 剥离可能的文件扩展名，避免 xxx.js.ts 这类错误路径
              const normalizedSubPath = subPath.replace(
                /\.(?:[cm]?js|ts)$/,
                ""
              );
              return {
                path: resolve(`../../config${normalizedSubPath}.ts`),
              };
            }
            return {
              path: resolve("../../config/index.ts"),
            };
          }
        );
      },
    });

    // mcp-core 已迁移到 src/mcp-core/，添加 alias 解析
    options.plugins.push({
      name: "mcp-core-alias",
      setup(build) {
        build.onResolve(
          { filter: /^@xiaozhi-client\/mcp-core(\/.*)?$/ },
          (args) => {
            const subPath = args.path.replace("@xiaozhi-client/mcp-core", "");
            if (subPath) {
              // 剥离可能的文件扩展名，避免 xxx.js.ts 这类错误路径
              const normalizedSubPath = subPath.replace(
                /\.(?:[cm]?js|ts)$/,
                ""
              );
              return {
                path: resolve(`../../mcp-core${normalizedSubPath}.ts`),
              };
            }
            return {
              path: resolve("../../mcp-core/index.ts"),
            };
          }
        );
      },
    });
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
    // config 已迁移到 src/config/，通过 alias 解析（不再 external）
    // version 已迁移到 src/utils/version.ts，通过 alias 解析（不再 external）
    // src/config/ 依赖的第三方包（不打包，运行时从 node_modules 加载）
    "comment-json",
    "core-util-is",
    "dayjs",
    // src/mcp-core/ 依赖的第三方包（不打包，运行时从 node_modules 加载）
    "@modelcontextprotocol/sdk",
    "eventsource",
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
    const rootPkgPath2 = resolve("../../package.json");

    const cliPkg = JSON.parse(readFileSync(cliPkgPath, "utf-8"));
    const rootPkg = JSON.parse(readFileSync(rootPkgPath2, "utf-8"));

    if (cliPkg.version !== rootPkg.version) {
      rootPkg.version = cliPkg.version;
      writeFileSync(rootPkgPath2, `${JSON.stringify(rootPkg, null, 2)}\n`);
      console.log(`✅ 已同步根 package.json 版本到 ${cliPkg.version}`);
    }
  },
});
