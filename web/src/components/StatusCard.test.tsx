import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ClientStatus } from "../types";
import StatusCard from "./StatusCard";

describe("StatusCard", () => {
  it("renders disconnected state when not connected", () => {
    render(<StatusCard connected={false} status={null} />);

    expect(screen.getByText("连接状态")).toBeInTheDocument();
    expect(screen.getByText("未连接")).toBeInTheDocument();
  });

  it("renders connected state with status info", () => {
    const status: ClientStatus = {
      status: "connected",
      mcpEndpoint: "wss://test.endpoint",
      activeMCPServers: ["calculator", "datetime"],
      lastHeartbeat: Date.now(),
    };

    render(<StatusCard connected={true} status={status} />);

    // 有两个"已连接"文本（配置服务器和小智服务）
    const connectedElements = screen.getAllByText("已连接");
    expect(connectedElements).toHaveLength(2);
    expect(screen.getByText("calculator")).toBeInTheDocument();
    expect(screen.getByText("datetime")).toBeInTheDocument();
  });

  it("renders disconnected to xiaozhi service state", () => {
    const status: ClientStatus = {
      status: "disconnected",
      mcpEndpoint: "wss://test.endpoint",
      activeMCPServers: [],
    };

    render(<StatusCard connected={true} status={status} />);

    expect(screen.getByText("未连接到小智服务")).toBeInTheDocument();
  });

  it("renders without active servers", () => {
    const status: ClientStatus = {
      status: "connected",
      mcpEndpoint: "wss://test.endpoint",
      activeMCPServers: [],
    };

    render(<StatusCard connected={true} status={status} />);

    expect(screen.queryByText("活跃 MCP 服务")).not.toBeInTheDocument();
  });
});
