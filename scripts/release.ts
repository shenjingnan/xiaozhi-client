import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 检查版本号是否符合 semver 规范
function isValidSemver(version: string): boolean {
  const semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverRegex.test(version);
}

// 更新文件中的版本号
async function updateVersionInFile(filePath: string, version: string) {
  const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  content.version = version;
  fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`);
}

// 生成 changelog
async function generateChangelog(version: string) {
  try {
    // 使用 conventional-changelog 生成 changelog
    await execa("npx", [
      "conventional-changelog",
      "-p", "conventionalcommits",
      "-i", "CHANGELOG.md",
      "-s",
      "-r", "0"
    ]);
    console.log("Changelog 生成完成");
  } catch (error) {
    console.error("生成 changelog 时出错:", error);
    // 如果 conventional-changelog 失败，我们继续执行，不中断发版流程
    console.log("跳过 changelog 生成，继续发版流程...");
  }
}

async function checkGitStatus() {
  try {
    const { stdout } = await execa("git", ["status", "--porcelain"]);
    if (stdout) {
      console.error("错误: 工作区不干净，请先提交或存储您的更改");
      process.exit(1);
    }
  } catch (error) {
    console.error("检查 git 状态时出错:", error);
    process.exit(1);
  }
}

async function checkExistingTag(version: string) {
  try {
    const { stdout } = await execa("git", [
      "ls-remote",
      "--tags",
      "origin",
      `v${version}`,
    ]);
    if (stdout) {
      console.error(`错误: 版本 v${version} 的 tag 已经存在`);
      process.exit(1);
    }
  } catch (error) {
    console.error("检查远程 tag 时出错:", error);
    process.exit(1);
  }
}

// 生成 GitHub PR URL
function getPRUrl(version: string) {
  // 基于当前项目的 GitHub 仓库：shenjingnan/xiaozhi-client
  const owner = "shenjingnan";
  const repo = "xiaozhi-client";
  return `https://github.com/${owner}/${repo}/compare/main...release/${version}?quick_pull=1&title=${encodeURIComponent(`release: ${version}`)}`;
}

async function main() {
  // 获取命令行参数
  const version = process.argv[2];

  // 检查是否提供了版本号参数
  if (!version) {
    console.error("错误: 请提供版本号参数");
    console.error("用法: pnpm run release <version>");
    process.exit(1);
  }

  // 检查版本号是否以 'v' 开头
  if (version.startsWith("v")) {
    console.error('错误: 版本号不应该以 "v" 开头');
    process.exit(1);
  }

  // 检查版本号格式
  if (!isValidSemver(version)) {
    console.error("错误: 版本号不符合 semver 规范");
    console.error("正确的格式例如: 1.0.0, 1.0.0-beta.1");
    process.exit(1);
  }

  console.log(`开始发布版本 ${version}`);

  // 1. 检查工作区状态
  console.log("检查工作区状态...");
  await checkGitStatus();

  // 2. 检查远程tag
  console.log("检查远程tag...");
  await checkExistingTag(version);

  try {
    // 3. 拉取主分支
    console.log("拉取主分支...");
    await execa("git", ["fetch", "origin"]);

    // 4. 创建发布分支
    console.log("创建发布分支...");
    await execa("git", ["checkout", "-b", `release/${version}`, "origin/main"]);

    // 5. 更新版本号
    console.log("更新版本号...");
    const packageJsonPath = path.join(__dirname, "../package.json");
    await updateVersionInFile(packageJsonPath, version);

    // 6. 生成changelog
    console.log("生成 changelog...");
    await generateChangelog(version);

    // 7. 提交并推送更改
    console.log("提交更改...");
    await execa("git", ["add", "."]);
    await execa("git", ["commit", "-m", `release: ${version}`]);
    await execa("git", ["push", "origin", `release/${version}`]);

    const prUrl = getPRUrl(version);

    console.log("\n✨ 发布流程完成！");
    console.log("请访问以下地址创建 Pull Request：");
    console.log(prUrl);
    process.exit(0);
  } catch (error) {
    console.error("发布过程中出错:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("发布失败:", error);
  process.exit(1);
});
