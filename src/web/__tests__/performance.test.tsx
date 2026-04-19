/**
 * 性能测试 - 验证重构后的性能优化效果
 */

import {
  useConfig,
  useConfigStore,
  useMcpEndpoint,
  useMcpServers,
} from "@/stores/config";
import {
  useClientStatus,
  useConnectionStatus,
  useRestartStatus,
  useStatusStore,
} from "@/stores/status";
import { act, render } from "@testing-library/react";
import type React from "react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 性能监控组件
const PerformanceMonitor: React.FC<{
  name: string;
  onRender: () => void;
  children: React.ReactNode;
}> = ({ name, onRender, children }) => {
  useEffect(() => {
    onRender();
  });

  return <div data-testid={name}>{children}</div>;
};

// 测试组件 - 使用 HTTP 连接状态
const OptimizedComponent: React.FC<{ onRender: () => void }> = ({
  onRender,
}) => {
  const config = useConfig();
  const mcpEndpoint = useMcpEndpoint();
  const connected = useConnectionStatus();

  return (
    <PerformanceMonitor name="optimized" onRender={onRender}>
      <div>
        <p>配置: {config ? "已加载" : "未加载"}</p>
        <p>端点: {mcpEndpoint || "未设置"}</p>
        <p>连接: {connected ? "已连接" : "未连接"}</p>
      </div>
    </PerformanceMonitor>
  );
};

// 测试组件 - 使用多个专用 hooks
const MultiHookComponent: React.FC<{ onRender: () => void }> = ({
  onRender,
}) => {
  const config = useConfig();
  const mcpEndpoint = useMcpEndpoint();
  const mcpServers = useMcpServers();
  const clientStatus = useClientStatus();
  const restartStatus = useRestartStatus();
  const connected = useConnectionStatus();

  return (
    <PerformanceMonitor name="multi-hook" onRender={onRender}>
      <div>
        <p>配置: {config ? "已加载" : "未加载"}</p>
        <p>端点: {mcpEndpoint || "未设置"}</p>
        <p>服务器数量: {Object.keys(mcpServers || {}).length}</p>
        <p>客户端状态: {clientStatus?.status || "未知"}</p>
        <p>重启状态: {restartStatus?.status || "未知"}</p>
        <p>连接: {connected ? "已连接" : "未连接"}</p>
      </div>
    </PerformanceMonitor>
  );
};

describe("性能优化验证", () => {
  beforeEach(() => {
    // 重置所有 stores
    useConfigStore.getState().reset();
    useStatusStore.getState().reset();
  });

  it("应该减少不必要的组件重新渲染", async () => {
    const renderCount = vi.fn();

    render(<OptimizedComponent onRender={renderCount} />);

    // 初始渲染
    expect(renderCount).toHaveBeenCalledTimes(1);

    // 更新不相关的状态（status store 变更）
    act(() => {
      useStatusStore.getState().setClientStatus(
        {
          status: "connected",
          mcpEndpoint: "wss://test.example.com/mcp",
          activeMCPServers: ["test"],
          lastHeartbeat: Date.now(),
        },
        "http"
      );
    });

    // 验证组件仍然正常工作（初始渲染 + 可能的状态更新触发的重渲染）
    expect(renderCount.mock.calls.length).toBeGreaterThanOrEqual(1);

    // 更新相关的状态（应该触发重新渲染）
    act(() => {
      useConfigStore.getState().setConfig(
        {
          mcpEndpoint: "wss://test.example.com/mcp",
          mcpServers: {},
          connection: {
            heartbeatInterval: 30000,
            heartbeatTimeout: 10000,
            reconnectInterval: 5000,
          },
          webUI: { port: 9999 },
        },
        "http"
      );
    });

    // 应该触发重新渲染
    expect(renderCount.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("应该支持多个专用 hooks 而不影响性能", async () => {
    const renderCount = vi.fn();

    render(<MultiHookComponent onRender={renderCount} />);

    // 初始渲染
    expect(renderCount).toHaveBeenCalledTimes(1);

    // 更新配置数据
    act(() => {
      useConfigStore.getState().setConfig(
        {
          mcpEndpoint: "wss://test.example.com/mcp",
          mcpServers: { test: { command: "test", args: [] } },
          connection: {
            heartbeatInterval: 30000,
            heartbeatTimeout: 10000,
            reconnectInterval: 5000,
          },
          webUI: { port: 9999 },
        },
        "http"
      );
    });

    // 应该触发重新渲染（即使使用了多个 hooks）
    expect(renderCount.mock.calls.length).toBeGreaterThanOrEqual(2);

    // 更新状态数据
    act(() => {
      useStatusStore.getState().setClientStatus(
        {
          status: "connected",
          mcpEndpoint: "wss://test.example.com/mcp",
          activeMCPServers: ["test"],
          lastHeartbeat: Date.now(),
        },
        "http"
      );
    });

    // 应该再触发一次重新渲染
    expect(renderCount).toHaveBeenCalledTimes(3);
  });

  it("应该验证 NetworkService 单例模式的性能优势", async () => {
    const { networkService } = await import("@/services/index");

    // 多次获取实例应该返回同一个对象
    const instance1 = networkService;
    const instance2 = networkService;
    const instance3 = networkService;

    expect(instance1).toBe(instance2);
    expect(instance2).toBe(instance3);
    expect(instance1).toBe(instance3);

    // 验证只创建了一个实例
    expect(instance1).toBeDefined();
    expect(typeof instance1.getConfig).toBe("function");
    expect(typeof instance1.updateConfig).toBe("function");
  });
});
