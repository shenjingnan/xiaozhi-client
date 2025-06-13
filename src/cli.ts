#!/usr/bin/env node

import { ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { configManager } from "./configManager.js";

const program = new Command();
const VERSION = "0.0.1";
const SERVICE_NAME = "xiaozhi-mcp-service";

// PID 文件路径
const PID_FILE = path.join(os.tmpdir(), `${SERVICE_NAME}.pid`);
const LOG_FILE = path.join(os.tmpdir(), `${SERVICE_NAME}.log`);

interface ServiceStatus {
  running: boolean;
  pid?: number;
  uptime?: string;
  mode?: "foreground" | "daemon";
}

/**
 * 获取服务状态
 */
function getServiceStatus(): ServiceStatus {
  try {
    if (!fs.existsSync(PID_FILE)) {
      return { running: false };
    }

    const pidContent = fs.readFileSync(PID_FILE, "utf8").trim();
    const [pidStr, startTime, mode] = pidContent.split("|");
    const pid = Number.parseInt(pidStr);

    if (isNaN(pid)) {
      // PID 文件损坏，删除它
      fs.unlinkSync(PID_FILE);
      return { running: false };
    }

    // 检查进程是否还在运行
    try {
      process.kill(pid, 0); // 发送信号 0 来检查进程是否存在

      // 计算运行时间
      const start = Number.parseInt(startTime);
      const uptime = formatUptime(Date.now() - start);

      return {
        running: true,
        pid,
        uptime,
        mode: (mode as "foreground" | "daemon") || "foreground",
      };
    } catch (error) {
      // 进程不存在，删除 PID 文件
      fs.unlinkSync(PID_FILE);
      return { running: false };
    }
  } catch (error) {
    return { running: false };
  }
}

/**
 * 格式化运行时间
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟 ${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * 保存 PID 信息
 */
function savePidInfo(pid: number, mode: "foreground" | "daemon") {
  const pidInfo = `${pid}|${Date.now()}|${mode}`;
  fs.writeFileSync(PID_FILE, pidInfo);
}

/**
 * 清理 PID 文件
 */
function cleanupPidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (error) {
    // 忽略清理错误
  }
}

/**
 * 检查配置文件和环境
 */
function checkEnvironment(): boolean {
  // 首先检查配置文件是否存在
  if (!configManager.configExists()) {
    console.error(chalk.red("❌ 错误: 配置文件不存在"));
    console.log(chalk.yellow('💡 提示: 请运行 "xiaozhi init" 初始化配置'));
    return false;
  }

  try {
    // 检查配置是否有效
    const endpoint = configManager.getMcpEndpoint();
    if (!endpoint || endpoint.includes("<请填写")) {
      console.error(chalk.red("❌ 错误: MCP 端点未配置"));
      console.log(
        chalk.yellow(
          '💡 提示: 请运行 "xiaozhi config mcpEndpoint <your-endpoint-url>" 设置端点'
        )
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      chalk.red(
        `❌ 错误: 配置文件无效 - ${error instanceof Error ? error.message : String(error)}`
      )
    );
    console.log(chalk.yellow('💡 提示: 请运行 "xiaozhi init" 重新初始化配置'));
    return false;
  }
}

/**
 * 获取服务启动命令和参数
 */
function getServiceCommand(): { command: string; args: string[]; cwd: string } {
  // 获取当前脚本所在目录
  const scriptDir = __dirname;

  // 检查是否在开发环境（js-demo/dist）还是全局安装环境
  let distDir: string;
  if (scriptDir.includes("js-demo/dist")) {
    // 开发环境
    distDir = scriptDir;
  } else {
    // 全局安装环境，需要找到实际的项目目录
    // 通常全局安装后，脚本在 node_modules/.bin 或类似位置
    // 我们需要找到实际的 dist 目录
    const possiblePaths = [
      path.join(scriptDir, "..", "js-demo", "dist"),
      path.join(scriptDir, "..", "..", "js-demo", "dist"),
      path.join(scriptDir, "..", "..", "..", "js-demo", "dist"),
      path.join(process.cwd(), "js-demo", "dist"),
      path.join(process.cwd(), "dist"),
    ];

    distDir =
      possiblePaths.find(
        (p) =>
          fs.existsSync(path.join(p, "mcpPipe.cjs")) &&
          fs.existsSync(path.join(p, "mcpServerProxy.cjs"))
      ) || scriptDir;
  }

  return {
    command: "node",
    args: ["mcpPipe.cjs", "mcpServerProxy.cjs"],
    cwd: distDir,
  };
}

/**
 * 启动服务
 */
async function startService(daemon = false): Promise<void> {
  const spinner = ora("检查服务状态...").start();

  try {
    // 检查服务是否已经在运行
    const status = getServiceStatus();
    if (status.running) {
      spinner.fail(`服务已经在运行 (PID: ${status.pid})`);
      return;
    }

    // 检查环境变量
    spinner.text = "检查环境配置...";
    if (!checkEnvironment()) {
      spinner.fail("环境配置检查失败");
      return;
    }

    // 获取启动命令
    const { command, args, cwd } = getServiceCommand();

    spinner.text = `启动服务 (${daemon ? "后台模式" : "前台模式"})...`;

    if (daemon) {
      // 后台模式
      const child = spawn(command, args, {
        cwd,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          XIAOZHI_CONFIG_DIR: process.cwd(), // 传递用户的当前工作目录
        },
      });

      // 保存 PID 信息
      savePidInfo(child.pid!, "daemon");

      // 设置日志输出
      const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
      child.stdout?.pipe(logStream);
      child.stderr?.pipe(logStream);

      // 分离进程
      child.unref();

      spinner.succeed(`服务已在后台启动 (PID: ${child.pid})`);
      console.log(chalk.gray(`日志文件: ${LOG_FILE}`));
      console.log(chalk.gray(`使用 'xiaozhi attach' 可以查看实时日志`));
    } else {
      // 前台模式
      spinner.succeed("服务启动中...");

      const child = spawn(command, args, {
        cwd,
        stdio: "inherit",
        env: {
          ...process.env,
          XIAOZHI_CONFIG_DIR: process.cwd(), // 传递用户的当前工作目录
        },
      });

      // 保存 PID 信息
      savePidInfo(child.pid!, "foreground");

      // 处理进程退出
      child.on("exit", (code, signal) => {
        cleanupPidFile();
        if (code !== 0) {
          console.log(
            chalk.red(`\n服务异常退出 (代码: ${code}, 信号: ${signal})`)
          );
        } else {
          console.log(chalk.green("\n服务已停止"));
        }
      });

      // 处理中断信号
      process.on("SIGINT", () => {
        console.log(chalk.yellow("\n正在停止服务..."));
        child.kill("SIGTERM");
      });

      process.on("SIGTERM", () => {
        child.kill("SIGTERM");
      });
    }
  } catch (error) {
    spinner.fail(
      `启动服务失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 停止服务
 */
async function stopService(): Promise<void> {
  const spinner = ora("检查服务状态...").start();

  try {
    const status = getServiceStatus();

    if (!status.running) {
      spinner.warn("服务未在运行");
      return;
    }

    spinner.text = `停止服务 (PID: ${status.pid})...`;

    try {
      // 尝试优雅停止
      process.kill(status.pid!, "SIGTERM");

      // 等待进程停止
      let attempts = 0;
      const maxAttempts = 30; // 3秒超时

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));

        try {
          process.kill(status.pid!, 0);
          attempts++;
        } catch {
          // 进程已停止
          break;
        }
      }

      // 检查是否还在运行
      try {
        process.kill(status.pid!, 0);
        // 如果还在运行，强制停止
        spinner.text = "强制停止服务...";
        process.kill(status.pid!, "SIGKILL");
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch {
        // 进程已停止
      }

      cleanupPidFile();
      spinner.succeed("服务已停止");
    } catch (error) {
      cleanupPidFile();
      spinner.fail(
        `停止服务失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } catch (error) {
    spinner.fail(
      `停止服务失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 检查服务状态
 */
async function checkStatus(): Promise<void> {
  const spinner = ora("检查服务状态...").start();

  try {
    const status = getServiceStatus();

    if (status.running) {
      spinner.succeed("服务状态");
      console.log(chalk.green("✅ 服务正在运行"));
      console.log(chalk.gray(`   PID: ${status.pid}`));
      console.log(chalk.gray(`   运行时间: ${status.uptime}`));
      console.log(
        chalk.gray(
          `   运行模式: ${status.mode === "daemon" ? "后台模式" : "前台模式"}`
        )
      );

      if (status.mode === "daemon") {
        console.log(chalk.gray(`   日志文件: ${LOG_FILE}`));
      }
    } else {
      spinner.succeed("服务状态");
      console.log(chalk.red("❌ 服务未运行"));
    }
  } catch (error) {
    spinner.fail(
      `检查状态失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 附加到后台服务
 */
async function attachService(): Promise<void> {
  const spinner = ora("检查服务状态...").start();

  try {
    const status = getServiceStatus();

    if (!status.running) {
      spinner.fail("服务未在运行");
      return;
    }

    if (status.mode !== "daemon") {
      spinner.fail("服务不是在后台模式运行");
      return;
    }

    spinner.succeed("连接到后台服务...");
    console.log(chalk.green(`已连接到服务 (PID: ${status.pid})`));
    console.log(chalk.gray("按 Ctrl+C 可以断开连接（不会停止服务）"));
    console.log(chalk.gray("=".repeat(50)));

    // 显示日志文件内容
    if (fs.existsSync(LOG_FILE)) {
      // 显示最后100行日志
      const { spawn } = await import("child_process");
      const tail = spawn("tail", ["-f", LOG_FILE], { stdio: "inherit" });

      // 处理中断信号
      process.on("SIGINT", () => {
        console.log(chalk.yellow("\n断开连接，服务继续在后台运行"));
        tail.kill();
        process.exit(0);
      });

      tail.on("exit", () => {
        process.exit(0);
      });
    } else {
      console.log(chalk.yellow("日志文件不存在"));
    }
  } catch (error) {
    spinner.fail(
      `连接失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 重启服务
 */
async function restartService(daemon = false): Promise<void> {
  console.log(chalk.blue("🔄 重启服务..."));

  // 先停止服务
  await stopService();

  // 等待一下确保完全停止
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 重新启动服务
  await startService(daemon);
}

/**
 * 显示版本信息
 */
function showVersion(): void {
  console.log(chalk.blue(`xiaozhi v${VERSION}`));
}

/**
 * 显示详细信息
 */
function showDetailedInfo(): void {
  console.log(chalk.blue(`xiaozhi v${VERSION}`));
  console.log(chalk.gray("MCP Calculator Service CLI Tool"));
  console.log(chalk.gray("Built with Node.js and TypeScript"));
  console.log(chalk.gray(`Node.js: ${process.version}`));
  console.log(chalk.gray(`Platform: ${process.platform} ${process.arch}`));
}

/**
 * 初始化配置
 */
async function initConfig(): Promise<void> {
  const spinner = ora("初始化配置...").start();

  try {
    if (configManager.configExists()) {
      spinner.warn("配置文件已存在");
      console.log(
        chalk.yellow("如需重新初始化，请先删除现有的 xiaozhi.config.json 文件")
      );
      return;
    }

    configManager.initConfig();
    spinner.succeed("配置文件初始化成功");

    console.log(chalk.green("✅ 配置文件已创建: xiaozhi.config.json"));
    console.log(chalk.yellow("📝 请编辑配置文件设置你的 MCP 端点:"));
    console.log(
      chalk.gray(`   配置文件路径: ${configManager.getConfigPath()}`)
    );
    console.log(chalk.yellow("💡 或者使用命令设置:"));
    console.log(
      chalk.gray("   xiaozhi config mcpEndpoint <your-endpoint-url>")
    );
  } catch (error) {
    spinner.fail(
      `初始化配置失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 创建项目命令
 */
async function createProject(
  templateName: string,
  projectName?: string
): Promise<void> {
  const spinner = ora("检查模板...").start();

  try {
    // 获取当前脚本所在目录
    const scriptDir = __dirname;

    // 查找 templates 目录
    let templatesDir: string;
    const possiblePaths = [
      path.join(scriptDir, "..", "templates"), // 开发环境
      path.join(scriptDir, "templates"), // 打包后的环境
      path.join(scriptDir, "..", "..", "templates"), // npm 全局安装
    ];

    templatesDir = possiblePaths.find((p) => fs.existsSync(p)) || "";

    if (!templatesDir || !fs.existsSync(templatesDir)) {
      spinner.fail("找不到 templates 目录");
      console.log(chalk.yellow("💡 提示: 请确保 xiaozhi-client 正确安装"));
      return;
    }

    // 检查模板是否存在
    const templatePath = path.join(templatesDir, templateName);
    if (!fs.existsSync(templatePath)) {
      spinner.fail(`模板 "${templateName}" 不存在`);

      // 列出可用的模板
      try {
        const availableTemplates = fs
          .readdirSync(templatesDir)
          .filter((item) =>
            fs.statSync(path.join(templatesDir, item)).isDirectory()
          );

        if (availableTemplates.length > 0) {
          console.log(chalk.yellow("可用的模板:"));
          availableTemplates.forEach((template) => {
            console.log(chalk.gray(`  - ${template}`));
          });
        } else {
          console.log(chalk.yellow("没有可用的模板"));
        }
      } catch (error) {
        // 忽略列出模板的错误
      }
      return;
    }

    // 确定项目名称和目标目录
    const targetName = projectName || templateName;
    const targetPath = path.join(process.cwd(), targetName);

    // 检查目标目录是否已存在
    if (fs.existsSync(targetPath)) {
      spinner.fail(`目录 "${targetName}" 已存在`);
      console.log(chalk.yellow("💡 提示: 请选择不同的项目名称或删除现有目录"));
      return;
    }

    spinner.text = `创建项目 "${targetName}"...`;

    // 复制模板到目标目录
    copyDirectory(templatePath, targetPath, [
      "node_modules",
      ".pnpm-debug.log",
      "pnpm-lock.yaml",
    ]);

    spinner.succeed(`项目 "${targetName}" 创建成功`);

    console.log(chalk.green("✅ 项目创建完成!"));
    console.log(chalk.yellow("📝 接下来的步骤:"));
    console.log(chalk.gray(`   cd ${targetName}`));
    console.log(chalk.gray("   pnpm install  # 安装依赖"));
    console.log(chalk.gray("   # 编辑 xiaozhi.config.json 设置你的 MCP 端点"));
    console.log(chalk.gray("   xiaozhi start  # 启动服务"));
  } catch (error) {
    spinner.fail(
      `创建项目失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 递归复制目录
 */
function copyDirectory(
  src: string,
  dest: string,
  excludePatterns: string[] = []
): void {
  // 创建目标目录
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const items = fs.readdirSync(src);

  for (const item of items) {
    // 检查是否应该排除此项
    if (excludePatterns.some((pattern) => item.includes(pattern))) {
      continue;
    }

    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath, excludePatterns);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 配置管理命令
 */
async function configCommand(key: string, value?: string): Promise<void> {
  const spinner = ora("更新配置...").start();

  try {
    if (!configManager.configExists()) {
      spinner.fail("配置文件不存在");
      console.log(chalk.yellow('💡 提示: 请先运行 "xiaozhi init" 初始化配置'));
      return;
    }

    if (!value) {
      // 显示配置值
      spinner.text = "读取配置...";
      const config = configManager.getConfig();

      switch (key) {
        case "mcpEndpoint":
          spinner.succeed("配置信息");
          console.log(chalk.green(`MCP 端点: ${config.mcpEndpoint}`));
          break;
        case "mcpServers":
          spinner.succeed("配置信息");
          console.log(chalk.green("MCP 服务:"));
          for (const [name, serverConfig] of Object.entries(
            config.mcpServers
          )) {
            console.log(
              chalk.gray(
                `  ${name}: ${serverConfig.command} ${serverConfig.args.join(" ")}`
              )
            );
          }
          break;
        default:
          spinner.fail(`未知的配置项: ${key}`);
          console.log(chalk.yellow("支持的配置项: mcpEndpoint, mcpServers"));
          return;
      }
    } else {
      // 设置配置值
      switch (key) {
        case "mcpEndpoint":
          configManager.updateMcpEndpoint(value);
          spinner.succeed(`MCP 端点已更新为: ${value}`);
          break;
        default:
          spinner.fail(`配置项 ${key} 不支持通过命令行设置`);
          console.log(chalk.yellow("支持设置的配置项: mcpEndpoint"));
          return;
      }
    }
  } catch (error) {
    spinner.fail(
      `配置操作失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log(chalk.blue.bold("xiaozhi - MCP Calculator Service CLI"));
  console.log();
  console.log(chalk.yellow("使用方法:"));
  console.log("  xiaozhi <command> [options]");
  console.log();
  console.log(chalk.yellow("命令:"));
  console.log("  create <template> [name] 从模板创建项目");
  console.log("  init                初始化配置文件");
  console.log("  config <key> [value] 查看或设置配置");
  console.log("  start [--daemon]    启动服务 (--daemon 后台运行)");
  console.log("  stop                停止服务");
  console.log("  status              检查服务状态");
  console.log("  attach              连接到后台服务查看日志");
  console.log("  restart [--daemon]  重启服务 (--daemon 后台运行)");
  console.log();
  console.log(chalk.yellow("选项:"));
  console.log("  -v, --version       显示版本信息");
  console.log("  -V                  显示详细信息");
  console.log("  -h, --help          显示帮助信息");
  console.log();
  console.log(chalk.yellow("项目示例:"));
  console.log("  xiaozhi create hello-world           # 创建 hello-world 项目");
  console.log(
    "  xiaozhi create hello-world my-app    # 创建名为 my-app 的项目"
  );
  console.log();
  console.log(chalk.yellow("配置示例:"));
  console.log("  xiaozhi init                          # 初始化配置");
  console.log("  xiaozhi config mcpEndpoint             # 查看 MCP 端点");
  console.log("  xiaozhi config mcpEndpoint wss://...   # 设置 MCP 端点");
  console.log();
  console.log(chalk.yellow("服务示例:"));
  console.log("  xiaozhi start                # 前台启动服务");
  console.log("  xiaozhi start --daemon       # 后台启动服务");
  console.log("  xiaozhi status               # 检查服务状态");
  console.log("  xiaozhi attach               # 查看后台服务日志");
  console.log("  xiaozhi stop                 # 停止服务");
}

// 配置 Commander 程序
program
  .name("xiaozhi")
  .description("MCP Calculator Service CLI Tool")
  .version(VERSION, "-v, --version", "显示版本信息")
  .helpOption("-h, --help", "显示帮助信息");

// create 命令
program
  .command("create <template> [name]")
  .description("从模板创建项目")
  .action(async (template, name) => {
    await createProject(template, name);
  });

// init 命令
program
  .command("init")
  .description("初始化配置文件")
  .action(async () => {
    await initConfig();
  });

// config 命令
program
  .command("config <key> [value]")
  .description("查看或设置配置")
  .action(async (key, value) => {
    await configCommand(key, value);
  });

// start 命令
program
  .command("start")
  .description("启动服务")
  .option("-d, --daemon", "在后台运行服务")
  .action(async (options) => {
    await startService(options.daemon);
  });

// stop 命令
program
  .command("stop")
  .description("停止服务")
  .action(async () => {
    await stopService();
  });

// status 命令
program
  .command("status")
  .description("检查服务状态")
  .action(async () => {
    await checkStatus();
  });

// attach 命令
program
  .command("attach")
  .description("连接到后台服务查看日志")
  .action(async () => {
    await attachService();
  });

// restart 命令
program
  .command("restart")
  .description("重启服务")
  .option("-d, --daemon", "在后台运行服务")
  .action(async (options) => {
    await restartService(options.daemon);
  });

// -V 选项 (详细信息)
program.option("-V", "显示详细信息").action((options) => {
  if (options.V) {
    showDetailedInfo();
    process.exit(0);
  }
});

// 处理无参数情况，显示帮助
if (process.argv.length <= 2) {
  showHelp();
  process.exit(0);
}

// 解析命令行参数
program.parse(process.argv);
