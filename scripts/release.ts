#!/usr/bin/env node

/**
 * 版本发布自动化脚本
 *
 * 功能：
 * - 验证环境和版本号
 * - 从 main 分支创建发布分支
 * - 执行 nx release 更新版本和 CHANGELOG
 * - 推送分支和 tags 到远程
 * - 自动创建发布 PR
 *
 * 使用方法：
 * tsx scripts/release.ts --version 1.11.0
 * tsx scripts/release.ts --version 1.11.0-beta.0
 * tsx scripts/release.ts --version 1.11.0 --dry-run
 */

import { consola } from "consola";
import { execa } from "execa";

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
 * 发布选项接口
 */
interface ReleaseOptions {
  /** 目标版本号 */
  version: string;
  /** 预演模式，不实际执行 */
  dryRun?: boolean;
}

/**
 * 版本信息接口
 */
interface VersionInfo {
  /** 原始版本号 */
  original: string;
  /** 是否为预发布版本 */
  isPrerelease: boolean;
  /** 预发布类型（beta/rc） */
  prereleaseType: "beta" | "rc" | null;
}

/**
 * Git 信息接口
 */
interface GitInfo {
  /** 仓库所有者 */
  owner: string;
  /** 仓库名称 */
  repo: string;
  /** 主分支名称 */
  baseBranch: string;
  /** 发布分支名称 */
  releaseBranch: string;
}

/**
 * PR 数据接口
 */
interface PRData {
  /** PR 标题 */
  title: string;
  /** PR 描述 */
  body: string;
  /** 源分支 */
  head: string;
  /** 目标分支 */
  base: string;
  /** 是否为草稿 */
  draft: boolean;
}

/**
 * GitHub API 错误响应接口
 */
interface GitHubApiError {
  message: string;
  errors?: Array<{
    message: string;
    resource: string;
    field: string;
    code?: string;
  }>;
}

/**
 * 解析版本号
 *
 * @param version - 版本号字符串
 * @returns 版本信息
 * @throws 当版本号格式无效时抛出错误
 */
function parseVersion(version: string): VersionInfo {
  // 支持的格式：
  // - 1.11.0（正式版）
  // - 1.11.0-beta.0（beta 版）
  // - 1.11.0-rc.0（rc 版）
  const prereleaseMatch = version.match(/^(\d+\.\d+\.\d+)-(beta|rc)\.(\d+)$/);
  const releaseMatch = version.match(/^(\d+\.\d+\.\d+)$/);

  if (prereleaseMatch) {
    return {
      original: version,
      isPrerelease: true,
      prereleaseType: prereleaseMatch[2] as "beta" | "rc",
    };
  }

  if (releaseMatch) {
    return {
      original: version,
      isPrerelease: false,
      prereleaseType: null,
    };
  }

  throw new Error(
    `无效的版本号格式: ${version}\n支持的格式：\n  - 正式版: 1.11.0\n  - Beta版: 1.11.0-beta.0\n  - RC版: 1.11.0-rc.0`
  );
}

/**
 * 获取远程仓库信息（owner/repo）
 *
 * @returns 仓库所有者和仓库名称
 * @throws 当无法获取远程仓库信息时抛出错误
 */
async function getRepoInfo(): Promise<{ owner: string; repo: string }> {
  try {
    const { stdout: remoteUrl } = await execa("git", [
      "remote",
      "get-url",
      "origin",
    ]);

    // 解析 URL 格式：
    // - https://github.com/owner/repo.git
    // - git@github.com:owner/repo.git
    const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(\.git)?$/);
    if (!match) {
      throw new Error(`无法解析仓库 URL: ${remoteUrl}`);
    }

    return { owner: match[1], repo: match[2] };
  } catch (error) {
    throw new Error(
      `获取仓库信息失败: ${(error as Error).message}. 请确保已设置 origin remote。`
    );
  }
}

/**
 * 获取主分支名称
 *
 * @returns 主分支名称
 */
async function getBaseBranch(): Promise<string> {
  try {
    // 尝试获取远程的 HEAD 分支
    const { stdout: symbolicRef } = await execa("git", [
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
    ]);
    return symbolicRef.replace("refs/remotes/origin/", "").trim();
  } catch {
    // 如果无法获取，尝试检测 main 或 master
    try {
      await execa("git", ["rev-parse", "--verify", "origin/main"]);
      return "main";
    } catch {
      try {
        await execa("git", ["rev-parse", "--verify", "origin/master"]);
        return "master";
      } catch {
        // 默认返回 main
        return "main";
      }
    }
  }
}

/**
 * 获取当前分支名称
 *
 * @returns 当前分支名称
 */
async function getCurrentBranch(): Promise<string> {
  try {
    const { stdout: branch } = await execa("git", ["branch", "--show-current"]);
    return branch.trim();
  } catch (error) {
    throw new Error(`获取当前分支失败: ${(error as Error).message}`);
  }
}

/**
 * 验证工作区状态
 *
 * @throws 当工作区有未提交更改时抛出错误
 */
async function checkWorkspaceClean(): Promise<void> {
  try {
    const { stdout: status } = await execa("git", ["status", "--porcelain"]);
    if (status.trim()) {
      throw new Error("工作区有未提交的更改，请先提交或暂存更改。");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("未提交的更改")) {
      throw error;
    }
    throw new Error(`检查工作区状态失败: ${(error as Error).message}`);
  }
}

/**
 * 验证 GitHub Token
 *
 * @throws 当 Token 未设置时抛出错误
 */
function checkGitHubToken(): void {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN 环境变量未设置。请设置 GitHub Personal Access Token:\n" +
        "  export GITHUB_TOKEN=your_token_here\n\n" +
        "或使用 GitHub CLI:\n" +
        "  export GITHUB_TOKEN=$(gh auth token)"
    );
  }
}

/**
 * 切换到主分支并更新
 *
 * @param baseBranch - 主分支名称
 * @param dryRun - 是否为预演模式
 */
async function switchToBaseBranch(
  baseBranch: string,
  dryRun: boolean
): Promise<void> {
  const currentBranch = await getCurrentBranch();

  if (currentBranch !== baseBranch) {
    log("info", `切换到主分支 ${baseBranch}...`);
    if (!dryRun) {
      await execa("git", ["checkout", baseBranch]);
    } else {
      log("info", `[预演] git checkout ${baseBranch}`);
    }
  }

  log("info", `更新 ${baseBranch} 分支...`);
  if (!dryRun) {
    await execa("git", ["fetch", "origin", baseBranch]);
    await execa("git", ["reset", "--hard", `origin/${baseBranch}`]);
  } else {
    log("info", `[预演] git fetch origin ${baseBranch}`);
    log("info", `[预演] git reset --hard origin/${baseBranch}`);
  }
}

/**
 * 创建发布分支
 *
 * @param version - 版本号
 * @param dryRun - 是否为预演模式
 * @returns 发布分支名称
 */
async function createReleaseBranch(
  version: string,
  dryRun: boolean
): Promise<string> {
  const branchName = `release/v${version}`;

  log("info", `创建发布分支 ${branchName}...`);
  if (!dryRun) {
    await execa("git", ["checkout", "-b", branchName]);
  } else {
    log("info", `[预演] git checkout -b ${branchName}`);
  }

  return branchName;
}

/**
 * 执行 nx release 命令
 *
 * @param version - 版本号
 * @param dryRun - 是否为预演模式
 */
async function executeNxRelease(version: string, dryRun: boolean): Promise<void> {
  log("info", `执行 nx release 版本更新...`);
  if (!dryRun) {
    await execa("pnpm", ["release:skip-publish", `--version=${version}`], {
      stdio: "inherit",
    });
  } else {
    log("info", `[预演] pnpm release:skip-publish --version=${version}`);
  }
}

/**
 * 推送分支到远程
 *
 * @param branch - 分支名称
 * @param dryRun - 是否为预演模式
 */
async function pushBranch(branch: string, dryRun: boolean): Promise<void> {
  log("info", `推送分支 ${branch} 到远程...`);
  if (!dryRun) {
    await execa("git", ["push", "-u", "origin", branch]);
  } else {
    log("info", `[预演] git push -u origin ${branch}`);
  }
}

/**
 * 推送 tags 到远程
 *
 * @param dryRun - 是否为预演模式
 */
async function pushTags(dryRun: boolean): Promise<void> {
  log("info", "推送 tags 到远程...");
  if (!dryRun) {
    await execa("git", ["push", "origin", "--tags"]);
  } else {
    log("info", "[预演] git push origin --tags");
  }
}

/**
 * 通过 GitHub API 创建 PR
 *
 * @param owner - 仓库所有者
 * @param repo - 仓库名称
 * @param prData - PR 数据
 * @returns 创建的 PR 信息
 * @throws 当 API 请求失败时抛出错误
 */
async function createPullRequest(
  owner: string,
  repo: string,
  prData: PRData
): Promise<{ html_url: string; number: number }> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GITHUB_TOKEN 环境变量未设置");
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(prData),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as GitHubApiError;
      const errorMessage = errorData.message || response.statusText;

      if (response.status === 401) {
        throw new Error(
          "GitHub 认证失败。请检查 GITHUB_TOKEN 是否正确且具有 repo 权限。"
        );
      }

      if (errorData.errors?.[0]?.message?.includes("not found")) {
        throw new Error(
          `分支 '${prData.head}' 未推送到远程仓库。`
        );
      }

      if (response.status === 422) {
        throw new Error(
          `PR 已存在或请求验证失败: ${errorMessage}\n` +
            `可能原因：分支 ${prData.head} 没有与 ${prData.base} 的差异。`
        );
      }

      throw new Error(`GitHub API 错误 (${response.status}): ${errorMessage}`);
    }

    const data = (await response.json()) as { html_url: string; number: number };
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`创建 PR 失败: ${String(error)}`);
  }
}

/**
 * 生成 PR 描述
 *
 * @param version - 版本号
 * @returns PR 描述
 */
function generatePRDescription(version: string): string {
  return `## 发布版本 v${version}

### 合并后操作
合并此 PR 后，GitHub Actions 将自动：
1. 检测到 PR 标题格式 \`Release: v${version}\`
2. 检出合并后的代码（包含版本 tag）
3. 执行 \`nx release publish\`
4. 发布到 npm
5. 创建 GitHub Release

---
🤖 Generated by [Claude Code](https://claude.com/claude-code)`;
}

/**
 * 创建发布 PR
 *
 * @param gitInfo - Git 信息
 * @param version - 版本号
 * @param dryRun - 是否为预演模式
 */
async function createReleasePR(
  gitInfo: GitInfo,
  version: string,
  dryRun: boolean
): Promise<void> {
  const prData: PRData = {
    title: `Release: v${version}`,
    body: generatePRDescription(version),
    head: gitInfo.releaseBranch,
    base: gitInfo.baseBranch,
    draft: false,
  };

  log("info", "创建发布 PR...");
  log("info", `  标题: ${prData.title}`);
  log("info", `  源分支: ${prData.head}`);
  log("info", `  目标分支: ${prData.base}`);

  if (dryRun) {
    log("info", `[预演] 将创建 PR: ${prData.title}`);
    return;
  }

  try {
    const result = await createPullRequest(gitInfo.owner, gitInfo.repo, prData);
    log("success", `✅ PR 创建成功！`);
    log("info", `  编号: #${result.number}`);
    log("info", `  链接: ${result.html_url}`);
  } catch (error) {
    log("error", (error as Error).message);
    throw error;
  }
}

/**
 * 显示发布摘要
 *
 * @param versionInfo - 版本信息
 * @param gitInfo - Git 信息
 * @param dryRun - 是否为预演模式
 */
function showSummary(
  versionInfo: VersionInfo,
  gitInfo: GitInfo,
  dryRun: boolean
): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log("📋 发布摘要");
  console.log("=".repeat(60));
  console.log(`版本号: v${versionInfo.original}`);
  console.log(
    `版本类型: ${versionInfo.isPrerelease ? `预发布版 (${versionInfo.prereleaseType})` : "正式版"}`
  );
  console.log(`主分支: ${gitInfo.baseBranch}`);
  console.log(`发布分支: ${gitInfo.releaseBranch}`);
  console.log(`仓库: ${gitInfo.owner}/${gitInfo.repo}`);
  console.log(`预演模式: ${dryRun ? "是" : "否"}`);
  console.log(`${"=".repeat(60)}\n`);
}

/**
 * 主函数
 *
 * @param options - 发布选项
 */
async function main(options: ReleaseOptions): Promise<void> {
  console.log("\n🚀 版本发布自动化脚本启动");
  console.log("=".repeat(60));

  // 1. 解析版本号
  let versionInfo: VersionInfo;
  try {
    versionInfo = parseVersion(options.version);
  } catch (error) {
    log("error", (error as Error).message);
    process.exit(1);
    return;
  }

  // 2. 验证环境
  log("info", "🔍 验证环境...");
  try {
    checkGitHubToken();
    await checkWorkspaceClean();
    log("success", "✅ 环境验证通过");
  } catch (error) {
    log("error", (error as Error).message);
    process.exit(1);
    return;
  }

  // 3. 获取 Git 信息
  log("info", "📊 收集 Git 信息...");
  const repoInfo = await getRepoInfo();
  const baseBranch = await getBaseBranch();
  const releaseBranch = `release/v${versionInfo.original}`;

  const gitInfo: GitInfo = {
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    baseBranch,
    releaseBranch,
  };

  log("info", `  仓库: ${gitInfo.owner}/${gitInfo.repo}`);
  log("info", `  主分支: ${gitInfo.baseBranch}`);
  log("info", `  发布分支: ${gitInfo.releaseBranch}`);

  // 4. 显示摘要
  showSummary(versionInfo, gitInfo, options.dryRun ?? false);

  // 5. 切换到主分支并更新
  try {
    await switchToBaseBranch(gitInfo.baseBranch, options.dryRun ?? false);
  } catch (error) {
    log("error", `切换分支失败: ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  // 6. 创建发布分支
  try {
    await createReleaseBranch(versionInfo.original, options.dryRun ?? false);
  } catch (error) {
    log("error", `创建发布分支失败: ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  // 7. 执行 nx release 命令
  try {
    await executeNxRelease(versionInfo.original, options.dryRun ?? false);
  } catch (error) {
    log("error", `执行 nx release 失败: ${(error as Error).message}`);
    log("info", "💡 提示：发布分支已创建，您可以手动修复问题后继续");
    process.exit(1);
    return;
  }

  // 8. 推送分支到远程
  try {
    await pushBranch(gitInfo.releaseBranch, options.dryRun ?? false);
  } catch (error) {
    log("error", `推送分支失败: ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  // 9. 推送 tags 到远程
  try {
    await pushTags(options.dryRun ?? false);
  } catch (error) {
    log("error", `推送 tags 失败: ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  // 10. 创建发布 PR
  try {
    await createReleasePR(gitInfo, versionInfo.original, options.dryRun ?? false);
  } catch (error) {
    log("error", `创建 PR 失败: ${(error as Error).message}`);
    log("info", "💡 提示：分支和 tags 已推送，您可以手动创建 PR");
    process.exit(1);
    return;
  }

  // 11. 完成
  console.log(`\n${"=".repeat(60)}`);
  log("success", "🎉 发布流程完成！");
  if (options.dryRun) {
    log("info", "💡 这是预演模式，未实际执行任何操作");
  } else {
    log("info", "💡 下一步：审查并合并发布 PR，合并后将自动触发 npm 发布");
  }
  console.log(`${"=".repeat(60)}\n`);
}

/**
 * 解析命令行参数
 *
 * @returns 解析后的选项
 */
function parseArgs(): ReleaseOptions {
  const args = process.argv.slice(2);

  const options: ReleaseOptions = {
    version: "",
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--version":
      case "-v":
        options.version = args[++i];
        break;
      case "--dry-run":
      case "-n":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
        break;
      default:
        if (!options.version && !arg.startsWith("--")) {
          options.version = arg;
        } else {
          log("error", `未知参数: ${arg}`);
          log("info", "使用 --help 查看帮助信息");
          process.exit(1);
        }
    }
  }

  if (!options.version) {
    log("error", "缺少版本号参数");
    log("info", "\n使用方法:");
    log("info", "  tsx scripts/release.ts --version <版本号>");
    log("info", "  tsx scripts/release.ts --version <版本号> --dry-run");
    log("info", "\n示例:");
    log("info", "  tsx scripts/release.ts --version 1.11.0");
    log("info", "  tsx scripts/release.ts --version 1.11.0-beta.0");
    log("info", "  tsx scripts/release.ts --version 1.11.0-rc.0");
    log("info", "  tsx scripts/release.ts --version 1.11.0 --dry-run");
    process.exit(1);
  }

  return options;
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log(`
版本发布自动化脚本

使用方法：
  tsx scripts/release.ts [选项]

选项：
  -v, --version <版本号>  目标版本号（必填）
  -n, --dry-run           预演模式，不实际执行
  -h, --help              显示帮助信息

环境变量：
  GITHUB_TOKEN            GitHub Personal Access Token（必需）

支持的版本号格式：
  - 正式版: 1.11.0
  - Beta版: 1.11.0-beta.0
  - RC版: 1.11.0-rc.0

示例：
  # 发布正式版
  tsx scripts/release.ts --version 1.11.0

  # 发布 beta 版
  tsx scripts/release.ts --version 1.11.0-beta.0

  # 预演模式（不实际执行）
  tsx scripts/release.ts --version 1.11.0 --dry-run

设置 GitHub Token:
  export GITHUB_TOKEN=your_token_here

  或使用 GitHub CLI:
  export GITHUB_TOKEN=$(gh auth token)
`);
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
const isMainModule = process.argv[1]?.endsWith("release.ts") ?? false;
if (isMainModule) {
  const options = parseArgs();
  main(options).catch((error: Error) => {
    log("error", `主函数执行失败: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

export { main, parseArgs, parseVersion };
