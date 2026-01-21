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

  // const mcpManager = new MCPManager();
  // mcpManager.addServer("calculator", mcpServers.calculator);
  // mcpManager.addServer("datetime", mcpServers.datetime);
  // await mcpManager.connect();
  // const tools = mcpManager.listTools();
  // console.log(tools);

  const endpointUrl1 =
    "wss://api.xiaozhi.me/mcp/?token=<token>";
  // 接入点 2
  const endpointUrl2 =
    "wss://api.xiaozhi.me/mcp/?token=<token>";
  const endpointManager = new EndpointManager({ mcpServers: mcpServers });
  endpointManager.addEndpoint(endpointUrl1);
  await endpointManager.connect();
  endpointManager.addEndpoint(endpointUrl2);
  await endpointManager.connect();
}
// 运行主函数
main().catch((error) => {
  console.error("未捕获的错误:", error);
  process.exit(1);
});
