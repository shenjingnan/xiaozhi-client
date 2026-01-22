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

  // 接入点 1
  const endpointUrl1 =
    "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwiYWdlbnRJZCI6MTMyNDE3OCwiZW5kcG9pbnRJZCI6ImFnZW50XzEzMjQxNzgiLCJwdXJwb3NlIjoibWNwLWVuZHBvaW50IiwiaWF0IjoxNzY4OTY2NzU4LCJleHAiOjE4MDA1MjQzNTh9.SDQqxD9Tz_MxA58KLAze2nnpA3Vhae1pWyzNguXT5Wv7DOulbhunO6Lz1XiKodntJOAmvU8fIf6mI7pytnFAzw";
  // 接入点 2
  const endpointUrl2 =
    "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwiYWdlbnRJZCI6MTMyNDMyMCwiZW5kcG9pbnRJZCI6ImFnZW50XzEzMjQzMjAiLCJwdXJwb3NlIjoibWNwLWVuZHBvaW50IiwiaWF0IjoxNzY4OTY2Nzc5LCJleHAiOjE4MDA1MjQzNzl9.VD43K8YEjhUVR1n4QX-PA9u_2P-jRA3vvwPxNKt7dM-lAUk73kCIaacpf3_I9wHYxYmAJwRDUFtFbWEPDVHBeg";

  // 创建 EndpointManager 并配置 MCP 服务
  const endpointManager = new EndpointManager();
  endpointManager.setMcpManager(mcpManager);

  // 一次性添加所有端点，然后统一连接
  endpointManager.addEndpoint(endpointUrl1);
  endpointManager.addEndpoint(endpointUrl2);

  // 只调用一次 connect()，确保 MCP 服务只连接一次
  await endpointManager.connect();

  // 保持程序运行
  console.log("服务运行中，按 Ctrl+C 退出");
  await new Promise(() => {});
}

// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});
