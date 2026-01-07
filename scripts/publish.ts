#!/usr/bin/env node

/**
 * NPM 多包发布脚本
 *
 * 功能：
 * - 解析版本号，识别类型 (beta/rc/正式版)
 * - 确定对应的 npm 标签 (beta/rc/latest)
 * - 使用 Nx Release 更新版本
 * - 执行构建
 * - 按依赖顺序发布所有包
 * - 支持预演模式 (dry-run)
 *
 * 使用方法：
 * pnpm release:publish --version 1.0.0-beta.0
 * pnpm release:publish --version 1.0.0-rc.0
 * pnpm release:publish --version 1.0.0
 * pnpm release:publish:dry --version 1.0.0-beta.0
 */

import { execaCommand } from "execa";
import { consola } from "consola";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * 版本类型
 */
type VersionType = "release" | "prerelease";

/**
 * 预发布标识
 */
type PrereleaseId = "beta" | "rc" | "";

/**
 * 版本信息接口
 */
interface VersionInfo {
  /** 原始版本号 */
  original: string;
  /** 版本类型 */
  type: VersionType;
  /** 预发布标识 */
  prereleaseId: PrereleaseId;
  /** npm 标签 */
  npmTag: "latest" | "beta" | "rc";
  /** 是否为正式版 */
  isRelease: boolean;
}

/**
 * 发布包信息接口
 */
interface PackageInfo {
  /** 包名 */
  name: string;
  /** 发布路径 */
  path: string;
}

/**
 * 日志级别
 */
type LogLevel = "info" | "success" | "error" | "warn";

/**
 * 日志函数
 */
function log(level: LogLevel, message: string): void {
  const methods: Record<LogLevel, keyof typeof consola> = {
    info: "info",
    success: "success",
    error: "error",
    warn: "warn",
  };
  (consola[methods[level]] as (msg: string) => void)(message);
}

/**
 * 解析版本号
 *
 * @param version - 版本号字符串
 * @returns 版本信息
 * @throws 当版本号格式无效时抛出错误
 */
function parseVersion(version: string): VersionInfo {
  const betaMatch = version.match(/^(\d+\.\d+\.\d+)-beta\.(\d+)$/);
  const rcMatch = version.match(/^(\d+\.\d+\.\d+)-rc\.(\d+)$/);
  const releaseMatch = version.match(/^(\d+\.\d+\.\d+)$/);

  if (betaMatch) {
    return {
      original: version,
      type: "prerelease",
      prereleaseId: "beta",
      npmTag: "beta",
      isRelease: false,
    };
  }

  if (rcMatch) {
    return {
      original: version,
      type: "prerelease",
      prereleaseId: "rc",
      npmTag: "rc",
      isRelease: false,
    };
  }

  if (releaseMatch) {
    return {
      original: version,
      type: "release",
      prereleaseId: "",
      npmTag: "latest",
      isRelease: true,
    };
  }

  throw new Error(`无效的版本号格式: ${version}`);
}

/**
 * 获取要发布的包列表
 *
 * 发布顺序：按依赖关系排序
 * 1. shared-types (无依赖)
 * 2. config (无内部依赖)
 * 3. cli (依赖 config)
 * 4. xiaozhi-client (根包)
 *
 * @returns 包列表
 */
function getPackages(): PackageInfo[] {
  return [
    {
      name: "@xiaozhi-client/shared-types",
      path: "packages/shared-types",
    },
    {
      name: "@xiaozhi-client/config",
      path: "packages/config",
    },
    {
      name: "@xiaozhi-client/cli",
      path: "packages/cli",
    },
    {
      name: "xiaozhi-client",
      path: ".",
    },
  ];
}

/**
 * 执行命令
 *
 * @param command - 要执行的命令
 * @param options - 执行选项
 * @returns 执行结果
 */
async function runCommand(
  command: string,
  options: {
    dryRun?: boolean;
    extraEnv?: Record<string, string>;
    cwd?: string;
  } = {}
): Promise<void> {
  const { dryRun = false, extraEnv = {}, cwd } = options;

  if (dryRun) {
    const envPrefix = Object.keys(extraEnv).length > 0
      ? `${Object.entries(extraEnv).map(([k, v]) => `${k}=${v}`).join(" ")} `
      : "";
    const cwdPrefix = cwd ? `(cd ${cwd}) ` : "";
    log("info", `[预演] ${cwdPrefix}${envPrefix}${command}`);
    return;
  }

  log("info", `执行: ${command}${cwd ? ` (在 ${cwd})` : ""}`);
  try {
    const result = await execaCommand(command, {
      stdio: "inherit",
      env: { NODE_ENV: "production", ...extraEnv },
      cwd,
    });

    // 检查退出码
    if (result.exitCode !== 0) {
      throw new Error(`命令退出码: ${result.exitCode}`);
    }
  } catch (error) {
    log("error", `命令执行失败: ${command}`);
    if (error instanceof Error) {
      log("error", `错误信息: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 更新版本号
 *
 * @param version - 目标版本号
 * @param dryRun - 是否为预演模式
 */
async function updateVersion(
  version: string,
  dryRun: boolean
): Promise<void> {
  log("info", `📦 使用 Nx Release 更新版本号为: ${version}`);

  // 使用 Nx Release 更新版本（自动处理所有包和依赖）
  await runCommand(
    `npx nx release version ${version}${dryRun ? " --dry-run" : ""}`,
    { dryRun }
  );

  log("success", `✅ 版本号已更新: ${version}`);
}

/**
 * 执行构建
 *
 * @param dryRun - 是否为预演模式
 */
async function runBuild(dryRun: boolean): Promise<void> {
  log("info", "🔨 开始构建项目...");

  // 禁用 Nx daemon 以避免状态异常问题
  await runCommand("pnpm build", { dryRun, extraEnv: { NX_DAEMON: "false" } });
  log("success", "✅ 项目构建完成");
}

/**
 * Git 提交信息接口
 */
interface GitCommit {
  /** 提交哈希 */
  hash: string;
  /** 提交类型 */
  type: string;
  /** 提交作用域 */
  scope: string | null;
  /** 提交描述 */
  description: string;
  /** 关联的 PR 或 Issue 编号 */
  refs: string[];
}

/**
 * 解析 Git 提交信息
 *
 * @param sinceTag - 起始 tag（不包含）
 * @returns 提交信息数组
 */
async function parseCommits(sinceTag?: string): Promise<GitCommit[]> {
  try {
    // 构建 git log 命令
    const range = sinceTag ? `${sinceTag}..HEAD` : "HEAD";
    const { stdout } = await execaCommand(
      `git log ${range} --pretty=format:"%H|%s"`,
      { stdio: "pipe" }
    );

    if (!stdout.trim()) {
      return [];
    }

    const commits: GitCommit[] = [];
    const lines = stdout.trim().split("\n");

    for (const line of lines) {
      const [hash, subject] = line.split("|", 2);
      if (!hash || !subject) continue;

      // 解析 conventional commit 格式
      // 格式: type(scope): description (#refs)
      const match = subject.match(/^(\w+)(?:\(([^)]+)\))?:?\s*(.+?)(?:\s*\((#[\d,]+)\))?$/);

      if (match) {
        const [, type, scope, description, refs] = match;
        commits.push({
          hash,
          type,
          scope: scope || null,
          description,
          refs: refs ? refs.split(/[,#]/).filter(Boolean).map((r) => `#${r}`) : [],
        });
      }
    }

    return commits;
  } catch (error) {
    log("warn", `解析 Git 提交失败: ${(error as Error).message}`);
    return [];
  }
}

/**
 * 生成 changelog 条目
 *
 * @param version - 版本号
 * @param commits - 提交信息数组
 * @returns 格式化的 changelog 条目
 */
function generateChangelogEntry(version: string, commits: GitCommit[]): string {
  const today = new Date().toISOString().split("T")[0];

  // 获取上一个 tag（用于生成对比链接）
  let previousTag = "v0.0.0";
  try {
    const { stdout } = execaCommand.sync("git describe --tags --abbrev=0 HEAD^", {
      stdio: "pipe",
    });
    if (stdout.trim()) {
      previousTag = stdout.trim();
    }
  } catch {
    // 如果没有上一个 tag，使用默认值
  }

  const lines: string[] = [];

  // 版本标题行
  lines.push(`## [${version}](https://github.com/shenjingnan/xiaozhi-client/compare/${previousTag}...v${version}) (${today})`);
  lines.push("");

  // 按类型分组
  const grouped = new Map<string, GitCommit[]>();
  const typeOrder = ["Features", "Bug Fixes", "Performance Improvements", "Reverts"];

  for (const commit of commits) {
    const type = commit.type === "feat" ? "Features" :
                 commit.type === "fix" ? "Bug Fixes" :
                 commit.type === "perf" ? "Performance Improvements" :
                 commit.type === "revert" ? "Reverts" : null;

    if (!type) continue;

    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)!.push(commit);
  }

  // 如果没有任何提交，返回空内容
  if (grouped.size === 0) {
    return `## [${version}](https://github.com/shenjingnan/xiaozhi-client/compare/${previousTag}...v${version}) (${today})\n\n### Features\n\n* 初始发布\n`;
  }

  // 生成分组内容
  for (const type of typeOrder) {
    const typeCommits = grouped.get(type);
    if (!typeCommits || typeCommits.length === 0) continue;

    lines.push(`### ${type}`);
    lines.push("");

    for (const commit of typeCommits) {
      const scope = commit.scope ? `**${commit.scope}:** ` : "";
      const refs = commit.refs.length > 0 ? ` ([${commit.refs.join(", ")}](https://github.com/shenjingnan/xiaozhi-client/issues/${commit.refs[0].replace("#", "")}))` : "";
      lines.push(`* ${scope}${commit.description}${refs}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 更新 changelog.mdx 文件
 *
 * @param version - 版本号
 * @param dryRun - 是否为预演模式
 */
async function updateChangelog(version: string, dryRun: boolean): Promise<void> {
  log("info", "📝 更新 changelog...");

  const changelogPath = join(process.cwd(), "docs/content/changelog.mdx");

  try {
    // 读取现有 changelog
    const existingContent = await readFile(changelogPath, "utf-8");

    // 解析 Git 提交
    const previousTag = await getPreviousTag();
    const commits = await parseCommits(previousTag);

    // 生成新的 changelog 条目
    const newEntry = generateChangelogEntry(version, commits);

    if (dryRun) {
      log("info", `[预演] 将在 changelog.mdx 开头插入:\n${newEntry}`);
      return;
    }

    // 在文件开头插入新条目（在第一行之后）
    const lines = existingContent.split("\n");
    const header = lines.slice(0, 1); // 保留第一行（标题）
    const content = lines.slice(1); // 其余内容

    const updatedContent = [header[0], "", newEntry, ...content].join("\n");

    // 写入文件
    await writeFile(changelogPath, updatedContent);
    log("success", "✅ changelog.mdx 已更新");
  } catch (error) {
    log("error", `更新 changelog 失败: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * 获取上一个 tag
 *
 * @returns 上一个 tag 名称
 */
async function getPreviousTag(): Promise<string | undefined> {
  try {
    const { stdout } = await execaCommand("git describe --tags --abbrev=0 HEAD^", {
      stdio: "pipe",
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 推送 Git 提交和 tag 到远程仓库
 *
 * @param dryRun - 是否为预演模式
 */
async function pushToRemote(dryRun: boolean): Promise<void> {
  log("info", "📤 推送 Git 提交和 tag 到远程仓库...");

  if (dryRun) {
    log("info", "[预演] git push origin <current-branch>");
    log("info", "[预演] git push origin --tags");
    return;
  }

  try {
    // 获取当前分支
    const { stdout: currentBranch } = await execaCommand("git branch --show-current", {
      stdio: "pipe",
    });
    const branch = currentBranch.trim();

    // 推送提交和 tag
    await runCommand(`git push origin ${branch}`, { dryRun: false });
    await runCommand("git push origin --tags", { dryRun: false });

    log("success", "✅ Git 提交和 tag 已推送到远程仓库");
  } catch (error) {
    log("error", `推送到远程仓库失败: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * 发布单个包
 *
 * @param pkg - 包信息
 * @param npmTag - npm 标签
 * @param dryRun - 是否为预演模式
 */
async function publishPackage(
  pkg: PackageInfo,
  npmTag: string,
  dryRun: boolean
): Promise<void> {
  // 所有包都使用相同的标签
  const tag = npmTag;
  const tagFlag = `--tag ${tag}`;

  log("info", `📤 发布包: ${pkg.name} (标签: ${tag})`);

  const publishCmd = `npm publish --access public ${tagFlag} --no-git-checks`;
  await runCommand(publishCmd, { dryRun, cwd: pkg.path || "." });

  log("success", `✅ ${pkg.name} 发布成功`);
}

/**
 * 发布所有包
 *
 * @param npmTag - npm 标签
 * @param dryRun - 是否为预演模式
 */
async function publishAllPackages(npmTag: string, dryRun: boolean): Promise<void> {
  const packages = getPackages();

  log("info", `📚 开始发布所有包 (标签: ${npmTag})`);

  for (const pkg of packages) {
    await publishPackage(pkg, npmTag, dryRun);
  }

  log("success", "✅ 所有包发布完成");
}

/**
 * 显示发布摘要
 *
 * @param versionInfo - 版本信息
 * @param dryRun - 是否为预演模式
 */
function showSummary(versionInfo: VersionInfo, dryRun: boolean): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log("📋 发布摘要");
  console.log("=".repeat(60));
  console.log(`版本号: ${versionInfo.original}`);
  console.log(`版本类型: ${versionInfo.type === "release" ? "正式版" : "预发布版"}`);
  console.log(`预发布标识: ${versionInfo.prereleaseId || "无"}`);
  console.log(`npm 标签: ${versionInfo.npmTag}`);
  console.log(`预演模式: ${dryRun ? "是" : "否"}`);
  console.log(`${"=".repeat(60)}\n`);
}

/**
 * 主函数
 *
 * @param version - 版本号
 * @param dryRun - 是否为预演模式
 */
async function main(version: string, dryRun: boolean): Promise<void> {
  console.log("\n🚀 NPM 多包发布脚本启动");
  console.log("=".repeat(60));

  // 1. 解析版本号
  let versionInfo: VersionInfo;
  try {
    versionInfo = parseVersion(version);
  } catch (error) {
    log("error", (error as Error).message);
    log("info", "\n支持的版本号格式:");
    log("info", "  - 正式版: 1.0.0");
    log("info", "  - Beta版: 1.0.0-beta.0");
    log("info", "  - RC版: 1.0.0-rc.0");
    process.exit(1);
    return;
  }

  // 2. 显示发布摘要
  showSummary(versionInfo, dryRun);

  // 3. 更新版本号
  try {
    await updateVersion(version, dryRun);
  } catch (error) {
    log("error", `版本号更新失败: ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  // 4. 执行构建
  try {
    await runBuild(dryRun);
  } catch (error) {
    log("error", `项目构建失败: ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  // 5. 发布所有包
  try {
    await publishAllPackages(versionInfo.npmTag, dryRun);
  } catch (error) {
    log("error", `包发布失败: ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  // 6. 正式版额外处理：更新 changelog、推送到远程
  if (versionInfo.isRelease) {
    try {
      // 6.1 更新 changelog（自定义路径）
      await updateChangelog(version, dryRun);

      // 6.2 推送 Git 提交和 tag（Nx Release 已自动创建）
      if (!dryRun) {
        await pushToRemote(dryRun);
      }
    } catch (error) {
      log("error", `Git 操作失败: ${(error as Error).message}`);
      log("warn", "⚠️ NPM 包已发布，但 Git 操作失败，请手动处理");
      process.exit(1);
      return;
    }
  }

  // 7. 完成
  console.log(`\n${"=".repeat(60)}`);
  log("success", "🎉 发布流程完成！");
  if (dryRun) {
    log("info", "💡 这是预演模式，未实际发布到 npm");
  }
  if (versionInfo.isRelease) {
    log("info", "💡 正式版：changelog 已更新，Git 提交和 tag 已推送到远程");
  }
  console.log(`${"=".repeat(60)}\n`);
}

/**
 * 解析命令行参数
 */
function parseArgs(): { version: string; dryRun: boolean } {
  const args = process.argv.slice(2);

  let version = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--version" || arg === "-v") {
      version = args[++i];
    } else if (arg === "--dry-run" || arg === "-d") {
      dryRun = true;
    } else if (!version && !arg.startsWith("--")) {
      version = arg;
    }
  }

  if (!version) {
    log("error", "缺少版本号参数");
    log("info", "\n使用方法:");
    log("info", "  tsx scripts/publish.ts --version <版本号>");
    log("info", "  tsx scripts/publish.ts --version <版本号> --dry-run");
    log("info", "\n示例:");
    log("info", "  tsx scripts/publish.ts --version 1.0.0-beta.0");
    log("info", "  tsx scripts/publish.ts --version 1.0.0-rc.0");
    log("info", "  tsx scripts/publish.ts --version 1.0.0");
    process.exit(1);
  }

  return { version, dryRun };
}

// 错误处理
process.on("uncaughtException", (error: Error) => {
  log("error", `未捕获的异常: ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  log("error", `未处理的 Promise 拒绝: ${String(reason)}`);
  process.exit(1);
});

// 检查是否直接运行此脚本
const isMainModule = process.argv[1]?.endsWith("publish.ts") ?? false;
if (isMainModule) {
  const { version, dryRun } = parseArgs();
  main(version, dryRun).catch((error: Error) => {
    log("error", `主函数执行失败: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

export { main, parseVersion, getPackages };
