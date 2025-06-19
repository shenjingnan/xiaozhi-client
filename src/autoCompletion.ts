import omelette from "omelette";
import { configManager } from "./configManager";

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
  const completion = omelette("xiaozhi <command>");

  // 处理主命令补全
  completion.on("command", ({ reply }) => {
    reply([
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
    ]);
  });

  // 处理复杂的多级命令补全
  completion.on("complete", (fragment, { line, before, reply }) => {
    // 调试信息
    if (process.env.XIAOZHI_DEBUG_COMPLETION) {
      console.error(
        `Debug completion - line: "${line}", before: "${before}", fragment: "${fragment}"`
      );
    }

    const parts = line.trim().split(/\s+/);
    const endsWithSpace = line !== line.trim();
    const currentIndex = endsWithSpace ? parts.length : parts.length - 1;

    // MCP 相关的补全
    if (parts[1] === "mcp") {
      const subcommand = parts[2];

      if (currentIndex === 2) {
        // mcp 子命令
        const subcommands = ["list", "server", "tool"];
        const current = parts[2] || "";
        const matches = subcommands.filter((cmd) => cmd.startsWith(current));
        reply(matches);
        return;
      }

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

    // 其他命令的子参数补全
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
        default:
          reply([]);
      }
      return;
    }

    // 默认情况
    reply([]);
  });

  // 处理补全相关的命令行参数
  if (process.argv.includes("--completion")) {
    // 输出补全脚本供shell使用
    try {
      console.log(completion.setupShellInitFile());
    } catch (error) {
      console.error("生成自动补全脚本时出错:", error);
    }
    process.exit(0);
  }

  if (process.argv.includes("--completion-fish")) {
    // Fish shell 补全
    console.log(completion.setupShellInitFile("fish"));
    process.exit(0);
  }

  if (
    process.argv.includes("--compzsh") ||
    process.argv.includes("--compbash")
  ) {
    // 处理实际的补全请求 - 这些是omelette内部使用的参数
    // 不需要手动处理，让omelette自己处理
  }

  // 初始化补全
  completion.init();
}

/**
 * 显示自动补全安装说明
 */
export function showCompletionHelp(): void {
  console.log("🚀 xiaozhi 自动补全设置");
  console.log();
  console.log("要启用自动补全，请根据你的shell执行以下命令：");
  console.log();
  console.log("📝 Zsh (推荐):");
  console.log("  xiaozhi --completion >> ~/.xiaozhi-completion.zsh");
  console.log("  echo 'source ~/.xiaozhi-completion.zsh' >> ~/.zshrc");
  console.log("  source ~/.zshrc");
  console.log();
  console.log("📝 Bash:");
  console.log("  xiaozhi --completion >> ~/.xiaozhi-completion.bash");
  console.log("  echo 'source ~/.xiaozhi-completion.bash' >> ~/.bash_profile");
  console.log("  source ~/.bash_profile");
  console.log();
  console.log("📝 Fish:");
  console.log(
    "  xiaozhi --completion-fish >> ~/.config/fish/completions/xiaozhi.fish"
  );
  console.log();
  console.log("✨ 设置完成后，你就可以使用 Tab 键进行自动补全了！");
  console.log();
  console.log("💡 示例:");
  console.log("  xiaozhi m<Tab>           # → mcp");
  console.log("  xiaozhi mcp l<Tab>       # → list");
  console.log("  xiaozhi mcp tool <Tab>   # → 显示所有服务器名称");
}
