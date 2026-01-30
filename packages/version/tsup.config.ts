import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

// 获取当前文件所在目录
const __dirname = dirname(fileURLToPath(import.meta.url));

// 读取根目录 package.json 获取版本号
const rootPkgPath = resolve(__dirname, "../../package.json");
const pkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));

export default defineConfig({
  entry: {
    index: resolve(__dirname, "src/index.ts"),
  },
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: {
    entry: ['src/index.ts'],
    compilerOptions: {
      composite: false
    }
  },
  minify: false,
  splitting: false,
  bundle: true,
  keepNames: true,
  platform: "node",
  // 使用版本包自己的 tsconfig.json
  tsconfig: resolve(__dirname, "tsconfig.json"),
  esbuildOptions: (options) => {
    options.resolveExtensions = [".ts", ".js", ".json"];

    // 构建时注入版本号常量
    // 如果构建时能读取到版本号，则注入真实值
    // 否则注入占位符，运行时从 package.json 读取
    const versionValue = pkg.version || "__VERSION__";
    const appNameValue = pkg.name || "__APP_NAME__";

    options.define = {
      ...options.define,
      __VERSION__: JSON.stringify(versionValue),
      __APP_NAME__: JSON.stringify(appNameValue),
    };
  },
  outExtension: () => ({
    js: ".js",
  }),
});
