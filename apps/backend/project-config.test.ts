import { describe, expect, it } from "vitest";

/**
 * 项目配置验证测试
 *
 * 该测试文件验证项目的整体配置正确性，包括：
 * - ESM 模块类型配置
 * - 构建工具配置
 * - 代码风格一致性
 *
 * 这些测试使用真实文件系统，确保项目配置符合开发规范。
 */
describe("项目配置验证", () => {
  // 使用实际的文件系统而不是 mock，因为我们需要验证真实的项目配置
  const realFs = require("node:fs");
  const realPath = require("node:path");

  // 获取项目根目录
  const getProjectRoot = () => {
    // 从当前测试文件位置向上查找 package.json
    let currentDir = realPath.dirname(__filename);
    while (currentDir !== realPath.dirname(currentDir)) {
      if (realFs.existsSync(realPath.join(currentDir, "package.json"))) {
        return currentDir;
      }
      currentDir = realPath.dirname(currentDir);
    }
    return process.cwd(); // 回退到当前工作目录
  };

  it("应该确保 postbuild.js 已被移除", () => {
    const projectRoot = getProjectRoot();
    const postbuildPath = realPath.join(projectRoot, "scripts", "postbuild.js");
    expect(realFs.existsSync(postbuildPath)).toBe(false);
  });

  it("应该确保 package.json 中不再引用 postbuild.js", () => {
    // 直接读取根 package.json，避免找到 apps/backend/package.json
    const rootPackageJsonPath = realPath.join(process.cwd(), "package.json");

    if (realFs.existsSync(rootPackageJsonPath)) {
      const packageJson = JSON.parse(
        realFs.readFileSync(rootPackageJsonPath, "utf8")
      );

      expect(packageJson.scripts?.build).not.toContain("postbuild.js");
      expect(packageJson.scripts?.dev).not.toContain("postbuild.js");
    }
  });

  it("应该确保项目使用 ESM 模块类型", () => {
    // 直接读取根 package.json，避免找到 apps/backend/package.json
    const rootPackageJsonPath = realPath.join(process.cwd(), "package.json");

    if (realFs.existsSync(rootPackageJsonPath)) {
      const packageJson = JSON.parse(
        realFs.readFileSync(rootPackageJsonPath, "utf8")
      );

      expect(packageJson.type).toBe("module");
    }
  });

  it("应该确保 tsup 配置为 ESM 格式", () => {
    // 使用根目录，因为 tsup.config.ts 在 config/ 目录下
    const rootDir = process.cwd();
    const tsupConfigPath = realPath.join(rootDir, "config", "tsup.config.ts");

    if (realFs.existsSync(tsupConfigPath)) {
      const tsupConfig = realFs.readFileSync(tsupConfigPath, "utf8");

      expect(tsupConfig).toContain('format: ["esm"]');
    }
  });

  it("应该确保 CLI 源码中不使用 CommonJS 语法", () => {
    // CLI 源码已迁移到 packages/cli/src/
    const projectRoot = getProjectRoot();
    const cliDir = realPath.join(projectRoot, "packages", "cli", "src");

    // 检查主要 CLI 入口文件
    const srcFiles = [
      "index.ts",
      "Container.ts",
      "commands/index.ts",
      "services/index.ts",
    ];

    for (const file of srcFiles) {
      const filePath = realPath.join(cliDir, file);
      if (realFs.existsSync(filePath)) {
        const content = realFs.readFileSync(filePath, "utf8");

        // 检查不应该使用的 CommonJS 语法
        expect(content).not.toMatch(/require\.main\s*===\s*module/);
        expect(content).not.toMatch(/module\.exports\s*=/);
        expect(content).not.toMatch(/^exports\./m);

        // 检查应该使用 ESM 语法
        if (content.includes("import.meta.url")) {
          // 如果使用了 import.meta.url，应该配合 fileURLToPath 使用
          if (
            content.includes("__filename") ||
            content.includes("__dirname")
          ) {
            expect(content).toMatch(/fileURLToPath\(import\.meta\.url\)/);
          }
        }
      }
    }
  });
});
