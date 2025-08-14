#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";

import { WebServer } from "./WebServer";
import { configManager } from "./configManager";
import { logger } from "./logger";
import { listMcpServers, listServerTools, setToolEnabled } from "./mcpCommands";

const program = new Command();
const SERVICE_NAME = "xiaozhi-mcp-service";

/**
 * 获取版本号
 */
export function getVersion(): string {
  try {
    // 在 ES 模块环境中获取当前目录
    const __filename = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(__filename);

    // 尝试多个可能的 package.json 路径
    const possiblePaths = [
      // 开发环境：src/cli.ts -> package.json
      path.join(currentDir, "..", "package.json"),
      // 构建后环境：dist/cli.js -> package.json
      path.join(currentDir, "..", "package.json"),
      // 全局安装环境
      path.join(currentDir, "..", "..", "package.json"),
      // 如果 package.json 被复制到 dist 目录
      path.join(currentDir, "package.json"),
    ];

    for (const packagePath of possiblePaths) {
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
        if (packageJson.version) {
          return packageJson.version;
        }
      }
    }

    // 如果都找不到，返回默认版本
    return "unknown";
  } catch (error) {
    console.warn("无法从 package.json 读取版本信息:", error);
    return "unknown";
  }
}

// PID 文件路径 - 使用项目目录下的 PID 文件，支持多实例运行
const getPidFile = () => {
  // 优先使用环境变量中的配置目录，否则使用当前工作目录
  const configDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
  return path.join(configDir, `.${SERVICE_NAME}.pid`);
};

interface ServiceStatus {
  running: boolean;
  pid?: number;
  uptime?: string;
  mode?: "foreground" | "daemon";
}

/**
 * 获取服务状态
 */
export function getServiceStatus(): ServiceStatus {
  try {
    const pidFile = getPidFile();
    if (!fs.existsSync(pidFile)) {
      return { running: false };
    }

    const pidContent = fs.readFileSync(pidFile, "utf8").trim();
    const [pidStr, startTime, mode] = pidContent.split("|");
    const pid = Number.parseInt(pidStr);

    if (Number.isNaN(pid)) {
      // PID 文件损坏，删除它
      fs.unlinkSync(pidFile);
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
      fs.unlinkSync(pidFile);
      return { running: false };
    }
  } catch (error) {
    return { running: false };
  }
}

/**
 * 格式化运行时间
 */
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`;
  }
  if (hours > 0) {
    return `${hours}小时 ${minutes % 60}分钟`;
  }
  if (minutes > 0) {
    return `${minutes}分钟 ${seconds % 60}秒`;
  }
  return `${seconds}秒`;
}

/**
 * 保存 PID 信息
 */
function savePidInfo(pid: number, mode: "foreground" | "daemon") {
  const pidInfo = `${pid}|${Date.now()}|${mode}`;
  fs.writeFileSync(getPidFile(), pidInfo);
}

/**
 * 清理 PID 文件
 */
function cleanupPidFile() {
  try {
    const pidFile = getPidFile();
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
  } catch (error) {
    // 忽略清理错误
  }
}

/**
 * 检查配置文件和环境
 */
export function checkEnvironment(): boolean {
  // 首先检查配置文件是否存在
  if (!configManager.configExists()) {
    console.error(chalk.red("❌ 错误: 配置文件不存在"));
    console.log(chalk.yellow('💡 提示: 请运行 "xiaozhi init" 初始化配置'));
    return false;
  }

  try {
    // 检查配置是否有效
    const endpoints = configManager.getMcpEndpoints();
    const validEndpoints = endpoints.filter(
      (endpoint) => endpoint && !endpoint.includes("<请填写")
    );

    if (validEndpoints.length === 0) {
      console.log(chalk.yellow("⚠️ 警告: MCP 端点未配置"));
      console.log(
        chalk.yellow(
          '💡 提示: 服务将启动但无法连接小智服务端，请运行 "xiaozhi config mcpEndpoint <your-endpoint-url>" 设置端点'
        )
      );
      console.log(
        chalk.gray(
          "   MCP 服务器功能仍然可用，可通过 Web 界面配置端点后重启服务"
        )
      );
    } else {
      console.log(
        chalk.green(`✅ 已配置 ${validEndpoints.length} 个有效的 MCP 端点`)
      );
    }
    return true;
  } catch (error) {
    console.error(
      chalk.red(
        `❌ 错误: 配置文件无效 - ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    );
    console.log(chalk.yellow('💡 提示: 请运行 "xiaozhi init" 重新初始化配置'));
    return false;
  }
}

/**
 * 启动服务（重构后的统一启动逻辑）
 */
async function startService(daemon = false, ui = false): Promise<void> {
  const spinner = ora("检查服务状态...").start();

  try {
    // 检查服务是否已经在运行
    const status = getServiceStatus();
    if (status.running) {
      spinner.fail(`服务已经在运行 (PID: ${status.pid})`);
      return;
    }

    // 检查环境配置
    spinner.text = "检查环境配置...";
    if (!checkEnvironment()) {
      spinner.fail("环境配置检查失败");
      return;
    }

    // 新的统一启动逻辑：直接启动 WebServer
    spinner.text = `启动服务 (${daemon ? "后台模式" : "前台模式"})...`;

    if (daemon) {
      await startWebServerInDaemon(ui);
      spinner.succeed("服务已在后台启动");
    } else {
      await startWebServerInForeground(ui);
      spinner.succeed("服务已启动");
    }
  } catch (error) {
    spinner.fail(
      `启动服务失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 后台模式启动 WebServer
 */
async function startWebServerInDaemon(openBrowser = false): Promise<void> {
  const { spawn } = await import("node:child_process");

  // 获取当前脚本所在目录
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));

  // 构建启动命令
  const command = "node";
  const args = [
    path.join(scriptDir, "webServerStandalone.js"), // 新的独立启动脚本
    openBrowser ? "--open-browser" : "",
  ].filter(Boolean);

  const child = spawn(command, args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      XIAOZHI_CONFIG_DIR: process.env.FORCE_CONFIG_DIR || process.cwd(),
      XIAOZHI_DAEMON: "true",
    },
  });

  // 保存 PID 信息
  savePidInfo(child.pid!, "daemon");

  // 初始化日志文件
  const projectDir = process.cwd();
  logger.initLogFile(projectDir);
  logger.enableFileLogging(true);

  // 设置日志输出到文件
  const logFilePath = path.join(projectDir, "xiaozhi.log");
  const logStream = fs.createWriteStream(logFilePath, { flags: "a" });
  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);

  // 监听进程异常退出
  child.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      logger.error(`后台服务异常退出 (代码: ${code}, 信号: ${signal})`);
    }
    cleanupPidFile();
  });

  // 监听进程错误
  child.on("error", (error) => {
    logger.error(`后台服务启动错误: ${error.message}`);
    cleanupPidFile();
    throw error;
  });

  // 分离进程
  child.unref();

  console.log(chalk.green(`✅ 服务已在后台启动 (PID: ${child.pid})`));
  console.log(chalk.gray(`日志文件: ${logFilePath}`));
  console.log(chalk.gray(`使用 'xiaozhi attach' 可以查看实时日志`));

  if (openBrowser) {
    console.log(chalk.green("🌐 浏览器将自动打开"));
  }
}

/**
 * 前台模式启动 WebServer
 */
async function startWebServerInForeground(openBrowser = false): Promise<void> {
  const webServer = new WebServer();

  // 处理退出信号
  const cleanup = async () => {
    console.log(chalk.yellow("\n正在停止服务..."));
    await webServer.stop();
    cleanupPidFile();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // 保存 PID 信息
  savePidInfo(process.pid, "foreground");

  await webServer.start();

  if (openBrowser) {
    const port = configManager.getWebUIPort();
    const url = `http://localhost:${port}`;
    // 自动打开浏览器逻辑
    await openBrowserUrl(url);
  }
}

/**
 * 打开浏览器URL
 */
async function openBrowserUrl(url: string): Promise<void> {
  try {
    const { spawn } = await import("node:child_process");
    const platform = process.platform;

    let command: string;
    let args: string[];

    if (platform === "darwin") {
      command = "open";
      args = [url];
    } else if (platform === "win32") {
      command = "start";
      args = ["", url];
    } else {
      command = "xdg-open";
      args = [url];
    }

    spawn(command, args, { detached: true, stdio: "ignore" });
    console.log(chalk.green(`🌐 已尝试打开浏览器: ${url}`));
  } catch (error) {
    console.log(chalk.yellow(`⚠️  自动打开浏览器失败，请手动访问: ${url}`));
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
        `停止服务失败: ${
          error instanceof Error ? error.message : String(error)
        }`
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
        const logFilePath = path.join(process.cwd(), "xiaozhi.log");
        console.log(chalk.gray(`   日志文件: ${logFilePath}`));
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
    const logFilePath = path.join(process.cwd(), "xiaozhi.log");
    if (fs.existsSync(logFilePath)) {
      // 跨平台的日志查看实现
      if (process.platform === "win32") {
        // Windows 使用 PowerShell 的 Get-Content -Wait
        const { spawn } = await import("node:child_process");
        const tail = spawn(
          "powershell",
          ["-Command", `Get-Content -Path "${logFilePath}" -Wait`],
          { stdio: "inherit" }
        );

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
        // Unix/Linux/macOS 使用 tail -f
        const { spawn } = await import("node:child_process");
        const tail = spawn("tail", ["-f", logFilePath], { stdio: "inherit" });

        // 处理中断信号
        process.on("SIGINT", () => {
          console.log(chalk.yellow("\n断开连接，服务继续在后台运行"));
          tail.kill();
          process.exit(0);
        });

        tail.on("exit", () => {
          process.exit(0);
        });
      }
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
async function restartService(daemon = false, ui = false): Promise<void> {
  console.log(chalk.blue("🔄 重启服务..."));

  // 先停止服务
  await stopService();

  // 等待一下确保完全停止
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 重新启动服务
  await startService(daemon, ui);
}

/**
 * 以 MCP Server 模式启动服务
 */
async function startMCPServerMode(port: number, daemon = false): Promise<void> {
  const spinner = ora("启动 MCP Server 模式...").start();

  try {
    // 检查配置是否存在
    if (!configManager.configExists()) {
      spinner.fail("配置文件不存在");
      console.log(chalk.yellow('💡 提示: 请先运行 "xiaozhi init" 初始化配置'));
      return;
    }

    // 导入 MCPServer
    const { MCPServer } = await import("./services/mcpServer.js");

    if (daemon) {
      // 后台模式 - 创建子进程
      const scriptPath = fileURLToPath(import.meta.url);
      const distDir = path.dirname(scriptPath);

      const child = spawn(
        "node",
        [path.join(distDir, "cli.js"), "start", "--server", port.toString()],
        {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            XIAOZHI_CONFIG_DIR: process.cwd(),
            XIAOZHI_DAEMON: "true",
            MCP_SERVER_MODE: "true",
          },
        }
      );

      // 保存 PID 信息
      savePidInfo(child.pid!, "daemon");

      // 设置日志输出
      const logFilePath = path.join(process.cwd(), "xiaozhi-mcp-server.log");
      const logStream = fs.createWriteStream(logFilePath, { flags: "a" });
      child.stdout?.pipe(logStream);
      child.stderr?.pipe(logStream);

      child.unref();

      spinner.succeed(
        `MCP Server 已在后台启动 (PID: ${child.pid}, Port: ${port})`
      );
      console.log(chalk.gray(`日志文件: ${logFilePath}`));
    } else {
      // 前台模式
      const server = new MCPServer(port);

      // 处理退出信号
      const cleanup = async () => {
        console.log(chalk.yellow("\n正在停止 MCP Server..."));
        await server.stop();
        process.exit(0);
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      await server.start();

      spinner.succeed("MCP Server 已启动");
      console.log(chalk.green("✅ MCP Server 端点已启动，可通过以下地址访问:"));
      console.log(chalk.green(`   SSE endpoint: http://localhost:${port}/sse`));
      console.log(
        chalk.green(`   Messages endpoint: http://localhost:${port}/messages`)
      );
      console.log(chalk.green(`   RPC endpoint: http://localhost:${port}/rpc`));
      console.log(chalk.green("   网络访问: 将 localhost 替换为你的IP地址"));
      console.log(chalk.yellow("💡 提示: 按 Ctrl+C 停止服务"));
    }
  } catch (error) {
    spinner.fail(
      `启动 MCP Server 失败: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * 显示详细信息
 */
function showDetailedInfo(): void {
  const version = getVersion();
  console.log(chalk.blue(`xiaozhi v${version}`));
  console.log(chalk.gray("MCP Calculator Service CLI Tool"));
  console.log(chalk.gray("Built with Node.js and TypeScript"));
  console.log(chalk.gray(`Node.js: ${process.version}`));
  console.log(chalk.gray(`Platform: ${process.platform} ${process.arch}`));
}

/**
 * 初始化配置
 * @param format 配置文件格式，默认为 json
 */
async function initConfig(
  format: "json" | "json5" | "jsonc" = "json"
): Promise<void> {
  const spinner = ora("初始化配置...").start();

  try {
    if (configManager.configExists()) {
      spinner.warn("配置文件已存在");
      console.log(chalk.yellow("如需重新初始化，请先删除现有的配置文件"));
      return;
    }

    configManager.initConfig(format);
    spinner.succeed("配置文件初始化成功");

    // 获取实际创建的配置文件路径
    const configDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
    const configFileName = `xiaozhi.config.${format}`;
    const configPath = path.join(configDir, configFileName);

    console.log(chalk.green(`✅ 配置文件已创建: ${configFileName}`));
    console.log(chalk.yellow("📝 请编辑配置文件设置你的 MCP 端点:"));
    console.log(chalk.gray(`   配置文件路径: ${configPath}`));
    console.log(chalk.yellow("💡 或者使用命令设置:"));
    console.log(
      chalk.gray("   xiaozhi config mcpEndpoint <your-endpoint-url>")
    );
  } catch (error) {
    spinner.fail(
      `初始化配置失败: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * 获取可用模板列表
 */
function getAvailableTemplates(): string[] {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const possiblePaths = [
    path.join(scriptDir, "..", "templates"), // 开发环境
    path.join(scriptDir, "templates"), // 打包后的环境
    path.join(scriptDir, "..", "..", "templates"), // npm 全局安装
  ];

  const templatesDir = possiblePaths.find((p) => fs.existsSync(p));
  if (!templatesDir) {
    return [];
  }

  return fs.readdirSync(templatesDir).filter((item) => {
    const itemPath = path.join(templatesDir, item);
    return fs.statSync(itemPath).isDirectory();
  });
}

/**
 * 计算字符串相似度（简单的编辑距离算法）
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }

  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : (maxLen - matrix[len1][len2]) / maxLen;
}

/**
 * 查找最相似的模板
 */
function findSimilarTemplate(
  input: string,
  templates: string[]
): string | null {
  if (templates.length === 0) return null;

  let bestMatch = templates[0];
  let bestSimilarity = calculateSimilarity(
    input.toLowerCase(),
    bestMatch.toLowerCase()
  );

  for (const template of templates.slice(1)) {
    const similarity = calculateSimilarity(
      input.toLowerCase(),
      template.toLowerCase()
    );
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = template;
    }
  }

  // 只有相似度超过 0.5 才认为是可能的匹配
  return bestSimilarity > 0.5 ? bestMatch : null;
}

/**
 * 询问用户确认
 */
async function askUserConfirmation(question: string): Promise<boolean> {
  // 检查是否在交互式终端中
  if (!process.stdin.isTTY) {
    // 非交互式环境，默认返回 false
    console.log("n (非交互式环境)");
    return false;
  }

  // 使用 readline 接口处理用户输入
  const readline = await import("node:readline");

  return new Promise((resolve) => {
    process.stdout.write(question);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const handleInput = (input: string) => {
      const char = input.trim().toLowerCase();
      if (char === "y" || char === "yes") {
        rl.close();
        resolve(true);
      } else if (char === "n" || char === "no" || char === "") {
        rl.close();
        resolve(false);
      } else {
        // 无效输入，重新询问
        process.stdout.write("请输入 y 或 n: ");
      }
    };

    rl.on("line", handleInput);
    rl.on("SIGINT", () => {
      rl.close();
      resolve(false);
    });
  });
}

/**
 * 创建基本的 xiaozhi.config.json 文件
 */
function createBasicConfig(projectPath: string): void {
  const configContent = {
    mcpEndpoint: "<请填写你的接入点地址（获取地址在 xiaozhi.me）>",
    mcpServers: {},
  };

  const configPath = path.join(projectPath, "xiaozhi.config.json");
  fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2), "utf8");
}

/**
 * 创建项目命令
 */
async function createProject(
  projectName: string,
  options: { template?: string }
): Promise<void> {
  const spinner = ora("初始化项目...").start();

  try {
    // 确定目标目录
    const targetPath = path.join(process.cwd(), projectName);

    // 检查目标目录是否已存在
    if (fs.existsSync(targetPath)) {
      spinner.fail(`目录 "${projectName}" 已存在`);
      console.log(chalk.yellow("💡 提示: 请选择不同的项目名称或删除现有目录"));
      return;
    }

    if (options.template) {
      // 使用模板创建项目
      spinner.text = "检查模板...";

      // 获取可用模板列表
      const availableTemplates = getAvailableTemplates();

      if (availableTemplates.length === 0) {
        spinner.fail("找不到 templates 目录");
        console.log(chalk.yellow("💡 提示: 请确保 xiaozhi-client 正确安装"));
        return;
      }

      // 检查模板是否存在
      if (!availableTemplates.includes(options.template)) {
        spinner.fail(`模板 "${options.template}" 不存在`);

        // 尝试找到相似的模板
        const similarTemplate = findSimilarTemplate(
          options.template,
          availableTemplates
        );

        if (similarTemplate) {
          console.log(
            chalk.yellow(`💡 你是想使用模板 "${similarTemplate}" 吗？`)
          );
          const confirmed = await askUserConfirmation(
            chalk.cyan("确认使用此模板？(y/n): ")
          );

          if (confirmed) {
            options.template = similarTemplate;
          } else {
            console.log(chalk.yellow("可用的模板:"));
            for (const template of availableTemplates) {
              console.log(chalk.gray(`  - ${template}`));
            }
            return;
          }
        } else {
          console.log(chalk.yellow("可用的模板:"));
          for (const template of availableTemplates) {
            console.log(chalk.gray(`  - ${template}`));
          }
          return;
        }
      }

      // 获取模板路径 (ESM 环境)
      const scriptDir = path.dirname(fileURLToPath(import.meta.url));
      const possiblePaths = [
        path.join(scriptDir, "..", "templates"), // 开发环境
        path.join(scriptDir, "templates"), // 打包后的环境
        path.join(scriptDir, "..", "..", "templates"), // npm 全局安装
      ];
      const templatesDir = possiblePaths.find((p) => fs.existsSync(p))!;
      const templatePath = path.join(templatesDir, options.template);

      spinner.text = `从模板 "${options.template}" 创建项目 "${projectName}"...`;

      // 复制模板到目标目录
      copyDirectory(templatePath, targetPath, [
        "node_modules",
        ".pnpm-debug.log",
        "pnpm-lock.yaml",
      ]);

      // 创建日志文件
      const logFilePath = path.join(targetPath, "xiaozhi.log");
      if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, "", "utf8");
      }

      spinner.succeed(`项目 "${projectName}" 创建成功`);

      console.log(chalk.green("✅ 项目创建完成!"));
      console.log(chalk.yellow("📝 接下来的步骤:"));
      console.log(chalk.gray(`   cd ${projectName}`));
      console.log(chalk.gray("   pnpm install  # 安装依赖"));
      console.log(
        chalk.gray("   # 编辑 xiaozhi.config.json 设置你的 MCP 端点")
      );
      console.log(chalk.gray("   xiaozhi start  # 启动服务"));
    } else {
      // 创建基本项目（只有配置文件）
      spinner.text = `创建基本项目 "${projectName}"...`;

      // 创建项目目录
      fs.mkdirSync(targetPath, { recursive: true });

      // 创建基本的 xiaozhi.config.json
      createBasicConfig(targetPath);

      // 创建日志文件
      const logFilePath = path.join(targetPath, "xiaozhi.log");
      fs.writeFileSync(logFilePath, "", "utf8");

      spinner.succeed(`项目 "${projectName}" 创建成功`);

      console.log(chalk.green("✅ 基本项目创建完成!"));
      console.log(chalk.yellow("📝 接下来的步骤:"));
      console.log(chalk.gray(`   cd ${projectName}`));
      console.log(
        chalk.gray("   # 编辑 xiaozhi.config.json 设置你的 MCP 端点和服务")
      );
      console.log(chalk.gray("   xiaozhi start  # 启动服务"));
      console.log(
        chalk.yellow("💡 提示: 使用 --template 选项可以从模板创建项目")
      );
    }
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
 * 启动 UI 服务
 */
async function startUIService(): Promise<void> {
  const spinner = ora("启动 UI 服务...").start();

  try {
    // 检查配置是否存在
    if (!configManager.configExists()) {
      spinner.fail("配置文件不存在");
      console.log(chalk.yellow('💡 提示: 请先运行 "xiaozhi init" 初始化配置'));
      return;
    }

    // 启动 Web 服务器
    const webServer = new WebServer();
    await webServer.start();

    spinner.succeed("UI 服务已启动");

    // 从配置获取端口号
    const port = configManager.getWebUIPort();
    console.log(chalk.green("✅ 配置管理网页已启动，可通过以下地址访问:"));
    console.log(chalk.green(`   本地访问: http://localhost:${port}`));
    console.log(chalk.green(`   网络访问: http://<你的IP地址>:${port}`));
    console.log(chalk.yellow("💡 提示: 按 Ctrl+C 停止服务"));

    // 自动打开浏览器
    const { spawn } = await import("node:child_process");
    const url = `http://localhost:${port}`;

    // 根据不同平台打开浏览器
    try {
      let browserProcess: ReturnType<typeof spawn>;
      if (process.platform === "darwin") {
        browserProcess = spawn("open", [url], {
          detached: true,
          stdio: "ignore",
        });
      } else if (process.platform === "win32") {
        browserProcess = spawn("cmd", ["/c", "start", url], {
          detached: true,
          stdio: "ignore",
        });
      } else {
        browserProcess = spawn("xdg-open", [url], {
          detached: true,
          stdio: "ignore",
        });
      }

      // 处理spawn错误，避免程序崩溃
      browserProcess.on("error", () => {
        // 静默处理浏览器启动错误，不影响主程序
        console.log(
          chalk.gray(`💡 提示: 无法自动打开浏览器，请手动访问: ${url}`)
        );
      });

      browserProcess.unref();
    } catch (error) {
      // 忽略打开浏览器的错误
      console.log(
        chalk.gray(`💡 提示: 无法自动打开浏览器，请手动访问: ${url}`)
      );
    }

    // 处理退出信号
    let isExiting = false;
    process.on("SIGINT", async () => {
      if (isExiting) {
        console.log(chalk.red("\n强制退出..."));
        process.exit(1);
      }
      isExiting = true;
      console.log(chalk.yellow("\n正在停止 UI 服务..."));
      try {
        await webServer.stop();
        console.log(chalk.green("UI 服务已停止"));
      } catch (error) {
        console.log(chalk.red("停止服务时出错，强制退出"));
      }
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      isExiting = true;
      await webServer.stop();
      process.exit(0);
    });
  } catch (error) {
    spinner.fail(
      `启动 UI 服务失败: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
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
        case "mcpEndpoint": {
          spinner.succeed("配置信息");
          const endpoints = configManager.getMcpEndpoints();
          if (endpoints.length === 0) {
            console.log(chalk.yellow("未配置任何 MCP 端点"));
          } else if (endpoints.length === 1) {
            console.log(chalk.green(`MCP 端点: ${endpoints[0]}`));
          } else {
            console.log(chalk.green(`MCP 端点 (${endpoints.length} 个):`));
            endpoints.forEach((ep, index) => {
              console.log(chalk.gray(`  ${index + 1}. ${ep}`));
            });
          }
          break;
        }
        case "mcpServers":
          spinner.succeed("配置信息");
          console.log(chalk.green("MCP 服务:"));
          for (const [name, serverConfig] of Object.entries(
            config.mcpServers
          )) {
            // 检查是否是 SSE 类型
            if ("type" in serverConfig && serverConfig.type === "sse") {
              console.log(chalk.gray(`  ${name}: [SSE] ${serverConfig.url}`));
            } else {
              console.log(
                chalk.gray(
                  `  ${name}: ${(serverConfig as any).command} ${(serverConfig as any).args.join(" ")}`
                )
              );
            }
          }
          break;
        case "connection": {
          spinner.succeed("配置信息");
          const connectionConfig = configManager.getConnectionConfig();
          console.log(chalk.green("连接配置:"));
          console.log(
            chalk.gray(
              `  心跳检测间隔: ${connectionConfig.heartbeatInterval}ms`
            )
          );
          console.log(
            chalk.gray(`  心跳超时时间: ${connectionConfig.heartbeatTimeout}ms`)
          );
          console.log(
            chalk.gray(`  重连间隔: ${connectionConfig.reconnectInterval}ms`)
          );
          break;
        }
        case "heartbeatInterval":
          spinner.succeed("配置信息");
          console.log(
            chalk.green(
              `心跳检测间隔: ${configManager.getHeartbeatInterval()}ms`
            )
          );
          break;
        case "heartbeatTimeout":
          spinner.succeed("配置信息");
          console.log(
            chalk.green(
              `心跳超时时间: ${configManager.getHeartbeatTimeout()}ms`
            )
          );
          break;
        case "reconnectInterval":
          spinner.succeed("配置信息");
          console.log(
            chalk.green(`重连间隔: ${configManager.getReconnectInterval()}ms`)
          );
          break;
        default:
          spinner.fail(`未知的配置项: ${key}`);
          console.log(
            chalk.yellow(
              "支持的配置项: mcpEndpoint, mcpServers, connection, heartbeatInterval, heartbeatTimeout, reconnectInterval"
            )
          );
          return;
      }
    } else {
      // 设置配置值
      switch (key) {
        case "mcpEndpoint":
          configManager.updateMcpEndpoint(value);
          spinner.succeed(`MCP 端点已更新为: ${value}`);
          break;
        case "heartbeatInterval": {
          const heartbeatInterval = Number.parseInt(value, 10);
          if (Number.isNaN(heartbeatInterval) || heartbeatInterval <= 0) {
            spinner.fail("心跳检测间隔必须是大于0的数字（毫秒）");
            return;
          }
          configManager.setHeartbeatInterval(heartbeatInterval);
          spinner.succeed(`心跳检测间隔已更新为: ${heartbeatInterval}ms`);
          break;
        }
        case "heartbeatTimeout": {
          const heartbeatTimeout = Number.parseInt(value, 10);
          if (Number.isNaN(heartbeatTimeout) || heartbeatTimeout <= 0) {
            spinner.fail("心跳超时时间必须是大于0的数字（毫秒）");
            return;
          }
          configManager.setHeartbeatTimeout(heartbeatTimeout);
          spinner.succeed(`心跳超时时间已更新为: ${heartbeatTimeout}ms`);
          break;
        }
        case "reconnectInterval": {
          const reconnectInterval = Number.parseInt(value, 10);
          if (Number.isNaN(reconnectInterval) || reconnectInterval <= 0) {
            spinner.fail("重连间隔必须是大于0的数字（毫秒）");
            return;
          }
          configManager.setReconnectInterval(reconnectInterval);
          spinner.succeed(`重连间隔已更新为: ${reconnectInterval}ms`);
          break;
        }
        default:
          spinner.fail(`配置项 ${key} 不支持通过命令行设置`);
          console.log(
            chalk.yellow(
              "支持设置的配置项: mcpEndpoint, heartbeatInterval, heartbeatTimeout, reconnectInterval"
            )
          );
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
  console.log("  create <projectName>     创建项目");
  console.log("  init                     初始化配置文件");
  console.log("  config <key> [value]     查看或设置配置");
  console.log(
    "  start [--daemon] [--ui] [--server]  启动服务 (--daemon 后台运行, --ui 同时启动 Web UI, --server MCP Server 模式)"
  );
  console.log("  stop                     停止服务");
  console.log("  status                   检查服务状态");
  console.log("  attach                   连接到后台服务查看日志");
  console.log(
    "  restart [--daemon] [--ui] 重启服务 (--daemon 后台运行, --ui 同时启动 Web UI)"
  );
  console.log("  ui                       启动配置管理网页");
  console.log();
  console.log(chalk.yellow("选项:"));
  console.log("  -v, --version            显示版本信息");
  console.log("  -V                       显示详细信息");
  console.log("  -h, --help               显示帮助信息");
  console.log("  -t, --template <name>    指定模板名称（用于 create 命令）");
  console.log();
  console.log(chalk.yellow("项目示例:"));
  console.log("  xiaozhi create my-app                    # 创建基本项目");
  console.log(
    "  xiaozhi create my-app -t hello-world     # 使用 hello-world 模板"
  );
  console.log(
    "  xiaozhi create my-app --template hello-world  # 同上，完整选项名"
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
  console.log("  xiaozhi start --ui           # 启动服务并同时启动 Web UI");
  console.log("  xiaozhi start -d -u          # 后台启动服务并同时启动 Web UI");
  console.log(
    "  xiaozhi start --server       # 以 MCP Server 模式启动 (端口 3000)"
  );
  console.log(
    "  xiaozhi start -s 8080        # 以 MCP Server 模式启动 (端口 8080)"
  );
  console.log("  xiaozhi start -s -d          # 后台运行 MCP Server");
  console.log("  xiaozhi status               # 检查服务状态");
  console.log("  xiaozhi attach               # 查看后台服务日志");
  console.log("  xiaozhi stop                 # 停止服务");
  console.log();
  console.log(chalk.yellow("MCP 管理示例:"));
  console.log("  xiaozhi mcp list             # 列出所有 MCP 服务");
  console.log("  xiaozhi mcp list --tools     # 列出所有服务的工具");
  console.log("  xiaozhi mcp server <name>    # 列出指定服务的工具");
  console.log("  xiaozhi mcp tool <server> <tool> enable   # 启用工具");
  console.log("  xiaozhi mcp tool <server> <tool> disable  # 禁用工具");
  console.log();
}

// 配置 Commander 程序
program
  .name("xiaozhi")
  .description("MCP Calculator Service CLI Tool")
  .version(getVersion(), "-v, --version", "显示版本信息")
  .helpOption("-h, --help", "显示帮助信息");

// create 命令
program
  .command("create <projectName>")
  .description("创建项目")
  .option("-t, --template <templateName>", "使用指定模板创建项目")
  .action(async (projectName, options) => {
    await createProject(projectName, options);
  });

// init 命令
program
  .command("init")
  .description("初始化配置文件")
  .option("-f, --format <format>", "配置文件格式 (json, json5, jsonc)", "json")
  .action(async (options) => {
    const format = options.format as "json" | "json5" | "jsonc";
    if (format !== "json" && format !== "json5" && format !== "jsonc") {
      console.error(chalk.red("错误: 格式必须是 json, json5 或 jsonc"));
      process.exit(1);
    }
    await initConfig(format);
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
  .option("-u, --ui", "同时启动 Web UI 服务")
  .option(
    "-s, --server [port]",
    "以 MCP Server 模式启动 (可选指定端口，默认 3000)"
  )
  .option("--stdio", "以 stdio 模式运行 MCP Server (用于 Cursor 等客户端)")
  .action(async (options) => {
    if (options.stdio) {
      // stdio 模式 - 直接运行 mcpServerProxy
      const { spawn } = await import("node:child_process");
      const scriptPath = fileURLToPath(import.meta.url);
      const distDir = path.dirname(scriptPath);
      const mcpProxyPath = path.join(distDir, "mcpServerProxy.js");

      // 直接执行 mcpServerProxy，它已经支持 stdio
      spawn("node", [mcpProxyPath], {
        stdio: "inherit",
        env: {
          ...process.env,
          // 如果用户没有设置 XIAOZHI_CONFIG_DIR，则使用当前工作目录
          XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
        },
      });
    } else if (options.server) {
      // MCP Server 模式
      const port =
        typeof options.server === "string"
          ? Number.parseInt(options.server)
          : 3000;
      await startMCPServerMode(port, options.daemon);
    } else {
      // 传统模式
      await startService(options.daemon, options.ui);
    }
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
  .option("-u, --ui", "同时启动 Web UI 服务")
  .action(async (options) => {
    await restartService(options.daemon, options.ui);
  });

// mcp 命令组
const mcpCommand = program.command("mcp").description("MCP 服务和工具管理");

// mcp list 命令
mcpCommand
  .command("list")
  .description("列出 MCP 服务")
  .option("--tools", "显示所有服务的工具列表")
  .action(async (options) => {
    await listMcpServers(options);
  });

// mcp <server> list 命令
mcpCommand
  .command("server <serverName>")
  .description("管理指定的 MCP 服务")
  .action(async (serverName) => {
    await listServerTools(serverName);
  });

// mcp <server> <tool> enable/disable 命令
mcpCommand
  .command("tool <serverName> <toolName> <action>")
  .description("启用或禁用指定服务的工具")
  .action(async (serverName, toolName, action) => {
    if (action !== "enable" && action !== "disable") {
      console.error(chalk.red("错误: 操作必须是 'enable' 或 'disable'"));
      process.exit(1);
    }

    const enabled = action === "enable";
    await setToolEnabled(serverName, toolName, enabled);
  });

// endpoint 命令组
const endpointCommand = program
  .command("endpoint")
  .description("管理 MCP 端点");

// endpoint list 命令
endpointCommand
  .command("list")
  .description("列出所有 MCP 端点")
  .action(async () => {
    const spinner = ora("读取端点配置...").start();
    try {
      const endpoints = configManager.getMcpEndpoints();
      spinner.succeed("端点列表");

      if (endpoints.length === 0) {
        console.log(chalk.yellow("未配置任何 MCP 端点"));
      } else {
        console.log(chalk.green(`共 ${endpoints.length} 个端点:`));
        endpoints.forEach((ep, index) => {
          console.log(chalk.gray(`  ${index + 1}. ${ep}`));
        });
      }
    } catch (error) {
      spinner.fail(
        `读取端点失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });

// endpoint add 命令
endpointCommand
  .command("add <url>")
  .description("添加新的 MCP 端点")
  .action(async (url) => {
    const spinner = ora("添加端点...").start();
    try {
      configManager.addMcpEndpoint(url);
      spinner.succeed(`成功添加端点: ${url}`);

      const endpoints = configManager.getMcpEndpoints();
      console.log(chalk.gray(`当前共 ${endpoints.length} 个端点`));
    } catch (error) {
      spinner.fail(
        `添加端点失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });

// endpoint remove 命令
endpointCommand
  .command("remove <url>")
  .description("移除指定的 MCP 端点")
  .action(async (url) => {
    const spinner = ora("移除端点...").start();
    try {
      configManager.removeMcpEndpoint(url);
      spinner.succeed(`成功移除端点: ${url}`);

      const endpoints = configManager.getMcpEndpoints();
      console.log(chalk.gray(`当前剩余 ${endpoints.length} 个端点`));
    } catch (error) {
      spinner.fail(
        `移除端点失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });

// endpoint set 命令
endpointCommand
  .command("set <urls...>")
  .description("设置 MCP 端点（可以是单个或多个）")
  .action(async (urls) => {
    const spinner = ora("设置端点...").start();
    try {
      if (urls.length === 1) {
        configManager.updateMcpEndpoint(urls[0]);
        spinner.succeed(`成功设置端点: ${urls[0]}`);
      } else {
        configManager.updateMcpEndpoint(urls);
        spinner.succeed(`成功设置 ${urls.length} 个端点`);
        for (const [index, url] of urls.entries()) {
          console.log(chalk.gray(`  ${index + 1}. ${url}`));
        }
      }
    } catch (error) {
      spinner.fail(
        `设置端点失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });

// ui 命令
program
  .command("ui")
  .description("启动配置管理网页")
  .action(async () => {
    await startUIService();
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
