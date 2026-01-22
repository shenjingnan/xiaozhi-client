import { MCPManager } from '@xiaozhi-client/mcp-core';
import { EndpointManager } from "@xiaozhi-client/endpoint";

async function main(): Promise<void> {
  const mcpServers = {
    calculator: {
      command: "npx",
      args: ["-y", "@xiaozhi-client/calculator-mcp@1.9.7-beta.16"],
    },
    datetime: {
      command: "npx",
      args: ["-y", "@xiaozhi-client/datetime-mcp@1.9.7-beta.16"],
    },
  };

  const mcpManager = new MCPManager();
  mcpManager.addServer("calculator", mcpServers.calculator);
  mcpManager.addServer("datetime", mcpServers.datetime);
  await mcpManager.connect();
  const tools = mcpManager.listTools();
  console.log(tools);

  // 接入点 1（示例占位符，请替换为你自己的有效 token）
  const endpointUrl1 =
    "wss://api.xiaozhi.me/mcp/?token=YOUR_ENDPOINT_1_TOKEN_HERE";
  // 接入点 2（示例占位符，请替换为你自己的有效 token）
  const endpointUrl2 =
    "wss://api.xiaozhi.me/mcp/?token=YOUR_ENDPOINT_2_TOKEN_HERE";

  // 创建 EndpointManager 并配置 MCP 服务
  const endpointManager = new EndpointManager();
  endpointManager.setMcpManager(mcpManager);

  // 一次性添加所有端点，然后统一连接
  endpointManager.addEndpoint(endpointUrl1);
  endpointManager.addEndpoint(endpointUrl2);

  // 只调用一次 connect()，确保 MCP 服务只连接一次
  await endpointManager.connect();

  // 保持程序运行，等待退出信号（如 Ctrl+C）
  console.log("服务运行中，按 Ctrl+C 退出");
  await new Promise<void>((resolve) => {
    const handleSignal = () => {
      resolve();
    };

    process.once("SIGINT", handleSignal);
    process.once("SIGTERM", handleSignal);
  });

  // 收到退出信号后，优雅关闭所有连接
  console.log("\n正在关闭服务...");
  await endpointManager.disconnect();
  await mcpManager.cleanup();
}

// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});
