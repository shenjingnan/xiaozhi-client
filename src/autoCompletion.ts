import omelette from "omelette";
import { configManager } from "./configManager.js";

/**
 * 自动补全功能模块
 */

/**
 * 获取所有可用的MCP服务器名称
 */
function getMcpServerNames(): string[] {
  try {
    if (!configManager.configExists()) {
      return [];
    }
    const mcpServers = configManager.getMcpServers();
    return Object.keys(mcpServers);
  } catch (error) {
    return [];
  }
}

/**
 * 获取指定服务器的工具名称
 */
function getServerToolNames(serverName: string): string[] {
  try {
    if (!configManager.configExists()) {
      return [];
    }
    const toolsConfig = configManager.getServerToolsConfig(serverName);
    return Object.keys(toolsConfig);
  } catch (error) {
    return [];
  }
}

/**
 * 设置自动补全功能
 */
export function setupAutoCompletion(): void {
  // 创建 omelette 实例，使用简单的模板
  const completion = omelette("xiaozhi");

  // 使用全局事件处理所有补全
  completion.on("complete", (fragment, { line, before, reply }) => {
    // 处理行尾空格的情况
    const trimmedLine = line.trim();
    const parts = trimmedLine.split(/\s+/);

    // 如果原始行以空格结尾，说明用户想要补全下一个参数
    const endsWithSpace = line !== trimmedLine;
    const currentIndex = endsWithSpace ? parts.length : parts.length - 1;

    // 主命令补全
    if (currentIndex === 1) {
      const commands = [
        "create",
        "init",
        "config",
        "start",
        "stop",
        "status",
        "attach",
        "restart",
        "mcp",
        "completion",
      ];

      const current = parts[1] || "";
      const matches = commands.filter((cmd) => cmd.startsWith(current));
      reply(matches);
      return;
    }

    // 子命令补全
    if (currentIndex === 2) {
      const command = parts[1];

      switch (command) {
        case "create":
          reply(["--template", "-t"]);
          break;
        case "start":
        case "restart":
          reply(["--daemon", "-d"]);
          break;
        case "completion":
          reply(["install", "uninstall"]);
          break;
        case "mcp": {
          const subcommands = ["list", "server", "tool"];
          const current = parts[2] || "";
          const matches = subcommands.filter((cmd) => cmd.startsWith(current));
          reply(matches);
          break;
        }
        default:
          reply([]);
      }
      return;
    }

    // MCP 相关的进一步补全
    if (parts[1] === "mcp") {
      const subcommand = parts[2];

      if (currentIndex === 3) {
        switch (subcommand) {
          case "list": {
            const options = ["--tools"];
            const current = parts[3] || "";
            const matches = options.filter((opt) => opt.startsWith(current));
            reply(matches);
            break;
          }
          case "server":
          case "tool": {
            const serverNames = getMcpServerNames();
            const current = parts[3] || "";
            const matches = serverNames.filter((name) =>
              name.startsWith(current)
            );
            reply(matches);
            break;
          }
          default:
            reply([]);
        }
        return;
      }

      if (currentIndex === 4 && subcommand === "tool") {
        const serverName = parts[3];
        const toolNames = getServerToolNames(serverName);
        const current = parts[4] || "";
        const matches = toolNames.filter((name) => name.startsWith(current));
        reply(matches);
        return;
      }

      if (currentIndex === 5 && subcommand === "tool") {
        const actions = ["enable", "disable"];
        const current = parts[5] || "";
        const matches = actions.filter((action) => action.startsWith(current));
        reply(matches);
        return;
      }
    }

    // 默认情况
    reply([]);
  });

  // 初始化补全
  completion.init();

  // 如果是补全模式，直接退出
  if (process.argv.includes("--completion")) {
    completion.setupShellInitFile();
    process.exit(0);
  }
}

/**
 * 安装自动补全到shell
 */
export function installCompletion(): void {
  const completion = omelette("xiaozhi");
  completion.setupShellInitFile();
  console.log("自动补全已安装到shell配置文件");
}

/**
 * 卸载自动补全
 */
export function uninstallCompletion(): void {
  const completion = omelette("xiaozhi");
  completion.cleanupShellInitFile();
  console.log("自动补全已从shell配置文件中移除");
}
