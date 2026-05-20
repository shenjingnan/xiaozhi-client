/**
 * SystemSettingDialog 组件测试
 *
 * 测试系统设置对话框的渲染、表单交互和配置更新功能。
 */
import { SystemSettingDialog } from "@/components/system-setting-dialog";
import * as websocketProvider from "@/providers/WebSocketProvider";
import * as stores from "@/stores/config";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { AppConfig } from "@xiaozhi-client/shared-types";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules
vi.mock("@/stores/config");
vi.mock("@/providers/WebSocketProvider");
vi.mock("sonner");

// Suppress console.error during tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe("SystemSettingDialog", () => {
  const mockConfig: AppConfig = {
    mcpEndpoint: "wss://api.xiaozhi.me/mcp/?token=test",
    mcpServers: {},
    modelscope: {
      apiKey: "test-modelscope-key",
    },
    platforms: {
      coze: {
        token: "test-coze-token",
      },
    },
    connection: {
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      reconnectInterval: 5000,
    },
  };

  beforeEach(() => {
    document.body.style.pointerEvents = "auto";
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(stores.useConfig).mockReturnValue(mockConfig);
    vi.mocked(websocketProvider.useWebSocketActions).mockReturnValue({
      getConfig: vi.fn().mockResolvedValue(mockConfig),
      updateConfig: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockResolvedValue({}),
      refreshStatus: vi.fn().mockResolvedValue(undefined),
      restartService: vi.fn().mockResolvedValue(undefined),
      updateConfigWithNotification: vi.fn().mockResolvedValue(undefined),
      restartServiceWithNotification: vi.fn().mockResolvedValue(undefined),
      setCustomWsUrl: vi.fn(),
      getWebSocketUrl: vi.fn().mockReturnValue("ws://localhost:8080"),
      changePort: vi.fn().mockResolvedValue(undefined),
      loadInitialData: vi.fn().mockResolvedValue(undefined),
      isWebSocketConnected: vi.fn().mockReturnValue(true),
      getWebSocketState: vi.fn().mockReturnValue({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("组件渲染和基本交互", () => {
    it("应该正确渲染设置按钮", () => {
      render(<SystemSettingDialog />);

      const settingsButton = screen.getByRole("button", { name: "" });
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toHaveClass("size-8");
    });

    it("点击设置按钮应该打开对话框", async () => {
      render(<SystemSettingDialog />);

      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      expect(screen.getByText("系统设置")).toBeInTheDocument();
      expect(screen.getByText("配置平台认证和连接参数")).toBeInTheDocument();
    });

    it("应该正确关闭对话框", async () => {
      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击取消按钮关闭对话框
      const cancelButton = screen.getByRole("button", { name: "取消" });
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(screen.queryByText("系统设置")).not.toBeInTheDocument();
      });
    });

    it("对话框应显示所有配置项", async () => {
      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 验证所有表单字段标题存在
      expect(screen.getByText("魔搭社区 API Key")).toBeInTheDocument();
      expect(screen.getByText("扣子身份凭证")).toBeInTheDocument();
      expect(screen.getByText("心跳间隔（毫秒）")).toBeInTheDocument();
      expect(screen.getByText("心跳超时（毫秒）")).toBeInTheDocument();
      expect(screen.getByText("重连间隔（毫秒）")).toBeInTheDocument();
    });
  });

  describe("表单交互", () => {
    it("应该正确初始化表单默认值", async () => {
      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 验证心跳间隔输入框的默认值
      const heartbeatIntervalInput =
        screen.getByPlaceholderText("心跳间隔（毫秒）");
      expect(heartbeatIntervalInput).toHaveValue(30000);

      // 验证心跳超时输入框的默认值
      const heartbeatTimeoutInput =
        screen.getByPlaceholderText("心跳超时（毫秒）");
      expect(heartbeatTimeoutInput).toHaveValue(10000);

      // 验证重连间隔输入框的默认值
      const reconnectIntervalInput =
        screen.getByPlaceholderText("重连间隔（毫秒）");
      expect(reconnectIntervalInput).toHaveValue(5000);
    });

    it("修改心跳间隔应更新表单值", async () => {
      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 修改心跳间隔
      const heartbeatIntervalInput =
        screen.getByPlaceholderText("心跳间隔（毫秒）");
      await act(async () => {
        fireEvent.change(heartbeatIntervalInput, {
          target: { value: "60000" },
        });
      });

      expect(heartbeatIntervalInput).toHaveValue(60000);
    });

    it("无效心跳间隔应显示验证错误", async () => {
      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 输入无效的心跳间隔（小于1000）
      const heartbeatIntervalInput =
        screen.getByPlaceholderText("心跳间隔（毫秒）");
      await act(async () => {
        fireEvent.change(heartbeatIntervalInput, { target: { value: "500" } });
      });

      // 点击保存触发验证
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText("心跳间隔不能小于1000毫秒")
        ).toBeInTheDocument();
      });
    });

    it("无效心跳超时应显示验证错误", async () => {
      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 输入无效的心跳超时（小于1000）
      const heartbeatTimeoutInput =
        screen.getByPlaceholderText("心跳超时（毫秒）");
      await act(async () => {
        fireEvent.change(heartbeatTimeoutInput, { target: { value: "500" } });
      });

      // 点击保存触发验证
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText("心跳超时不能小于1000毫秒")
        ).toBeInTheDocument();
      });
    });

    it("无效重连间隔应显示验证错误", async () => {
      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 输入无效的重连间隔（小于1000）
      const reconnectIntervalInput =
        screen.getByPlaceholderText("重连间隔（毫秒）");
      await act(async () => {
        fireEvent.change(reconnectIntervalInput, { target: { value: "500" } });
      });

      // 点击保存触发验证
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText("重连间隔不能小于1000毫秒")
        ).toBeInTheDocument();
      });
    });
  });

  describe("配置更新", () => {
    it("提交有效配置应调用 updateConfig", async () => {
      const updateConfigMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(websocketProvider.useWebSocketActions).mockReturnValue({
        getConfig: vi.fn().mockResolvedValue(mockConfig),
        updateConfig: updateConfigMock,
        getStatus: vi.fn().mockResolvedValue({}),
        refreshStatus: vi.fn().mockResolvedValue(undefined),
        restartService: vi.fn().mockResolvedValue(undefined),
        updateConfigWithNotification: vi.fn().mockResolvedValue(undefined),
        restartServiceWithNotification: vi.fn().mockResolvedValue(undefined),
        setCustomWsUrl: vi.fn(),
        getWebSocketUrl: vi.fn().mockReturnValue("ws://localhost:8080"),
        changePort: vi.fn().mockResolvedValue(undefined),
        loadInitialData: vi.fn().mockResolvedValue(undefined),
        isWebSocketConnected: vi.fn().mockReturnValue(true),
        getWebSocketState: vi.fn().mockReturnValue({}),
      });

      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击保存按钮
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(updateConfigMock).toHaveBeenCalledTimes(1);
        // 验证关键配置项被正确传递
        expect(updateConfigMock).toHaveBeenCalledWith(
          expect.objectContaining({
            modelscope: { apiKey: "test-modelscope-key" },
            connection: {
              heartbeatInterval: 30000,
              heartbeatTimeout: 10000,
              reconnectInterval: 5000,
            },
          })
        );
      });
    });

    it("配置更新成功应显示成功提示", async () => {
      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击保存按钮
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("配置已更新");
      });
    });

    it("配置更新成功应关闭对话框", async () => {
      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击保存按钮
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.queryByText("系统设置")).not.toBeInTheDocument();
      });
    });

    it("配置更新失败应显示错误提示", async () => {
      const errorMessage = "更新配置失败";
      vi.mocked(websocketProvider.useWebSocketActions).mockReturnValue({
        getConfig: vi.fn().mockResolvedValue(mockConfig),
        updateConfig: vi.fn().mockRejectedValue(new Error(errorMessage)),
        getStatus: vi.fn().mockResolvedValue({}),
        refreshStatus: vi.fn().mockResolvedValue(undefined),
        restartService: vi.fn().mockResolvedValue(undefined),
        updateConfigWithNotification: vi.fn().mockResolvedValue(undefined),
        restartServiceWithNotification: vi.fn().mockResolvedValue(undefined),
        setCustomWsUrl: vi.fn(),
        getWebSocketUrl: vi.fn().mockReturnValue("ws://localhost:8080"),
        changePort: vi.fn().mockResolvedValue(undefined),
        loadInitialData: vi.fn().mockResolvedValue(undefined),
        isWebSocketConnected: vi.fn().mockReturnValue(true),
        getWebSocketState: vi.fn().mockReturnValue({}),
      });

      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击保存按钮
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(errorMessage);
      });
    });

    it("网络请求失败应正确处理非 Error 对象错误", async () => {
      vi.mocked(websocketProvider.useWebSocketActions).mockReturnValue({
        getConfig: vi.fn().mockResolvedValue(mockConfig),
        updateConfig: vi.fn().mockRejectedValue("字符串错误"),
        getStatus: vi.fn().mockResolvedValue({}),
        refreshStatus: vi.fn().mockResolvedValue(undefined),
        restartService: vi.fn().mockResolvedValue(undefined),
        updateConfigWithNotification: vi.fn().mockResolvedValue(undefined),
        restartServiceWithNotification: vi.fn().mockResolvedValue(undefined),
        setCustomWsUrl: vi.fn(),
        getWebSocketUrl: vi.fn().mockReturnValue("ws://localhost:8080"),
        changePort: vi.fn().mockResolvedValue(undefined),
        loadInitialData: vi.fn().mockResolvedValue(undefined),
        isWebSocketConnected: vi.fn().mockReturnValue(true),
        getWebSocketState: vi.fn().mockReturnValue({}),
      });

      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击保存按钮
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("更新配置失败");
      });
    });
  });

  describe("边界情况", () => {
    it("配置未加载时应阻止提交并显示错误", async () => {
      vi.mocked(stores.useConfig).mockReturnValue(null);

      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击保存按钮
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("配置数据未加载，请稍后重试");
      });

      // 验证 updateConfig 未被调用
      expect(
        websocketProvider.useWebSocketActions().updateConfig
      ).not.toHaveBeenCalled();
    });

    it("空 API Key 应允许提交（可选配置）", async () => {
      const configWithEmptyApiKey: AppConfig = {
        ...mockConfig,
        modelscope: { apiKey: "" },
      };
      vi.mocked(stores.useConfig).mockReturnValue(configWithEmptyApiKey);

      const updateConfigMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(websocketProvider.useWebSocketActions).mockReturnValue({
        getConfig: vi.fn().mockResolvedValue(configWithEmptyApiKey),
        updateConfig: updateConfigMock,
        getStatus: vi.fn().mockResolvedValue({}),
        refreshStatus: vi.fn().mockResolvedValue(undefined),
        restartService: vi.fn().mockResolvedValue(undefined),
        updateConfigWithNotification: vi.fn().mockResolvedValue(undefined),
        restartServiceWithNotification: vi.fn().mockResolvedValue(undefined),
        setCustomWsUrl: vi.fn(),
        getWebSocketUrl: vi.fn().mockReturnValue("ws://localhost:8080"),
        changePort: vi.fn().mockResolvedValue(undefined),
        loadInitialData: vi.fn().mockResolvedValue(undefined),
        isWebSocketConnected: vi.fn().mockReturnValue(true),
        getWebSocketState: vi.fn().mockReturnValue({}),
      });

      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击保存按钮
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(updateConfigMock).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith("配置已更新");
      });
    });

    it("空 Coze Token 应允许提交（可选配置）", async () => {
      const configWithEmptyCozeToken: AppConfig = {
        ...mockConfig,
        platforms: { coze: { token: "" } },
      };
      vi.mocked(stores.useConfig).mockReturnValue(configWithEmptyCozeToken);

      const updateConfigMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(websocketProvider.useWebSocketActions).mockReturnValue({
        getConfig: vi.fn().mockResolvedValue(configWithEmptyCozeToken),
        updateConfig: updateConfigMock,
        getStatus: vi.fn().mockResolvedValue({}),
        refreshStatus: vi.fn().mockResolvedValue(undefined),
        restartService: vi.fn().mockResolvedValue(undefined),
        updateConfigWithNotification: vi.fn().mockResolvedValue(undefined),
        restartServiceWithNotification: vi.fn().mockResolvedValue(undefined),
        setCustomWsUrl: vi.fn(),
        getWebSocketUrl: vi.fn().mockReturnValue("ws://localhost:8080"),
        changePort: vi.fn().mockResolvedValue(undefined),
        loadInitialData: vi.fn().mockResolvedValue(undefined),
        isWebSocketConnected: vi.fn().mockReturnValue(true),
        getWebSocketState: vi.fn().mockReturnValue({}),
      });

      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击保存按钮
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(updateConfigMock).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith("配置已更新");
      });
    });

    it("配置更新后应保留其他平台配置", async () => {
      const configWithMultiplePlatforms: AppConfig = {
        ...mockConfig,
        platforms: {
          coze: { token: "test-coze-token" },
          other: { token: "other-token" },
        },
      };
      vi.mocked(stores.useConfig).mockReturnValue(configWithMultiplePlatforms);

      const updateConfigMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(websocketProvider.useWebSocketActions).mockReturnValue({
        getConfig: vi.fn().mockResolvedValue(configWithMultiplePlatforms),
        updateConfig: updateConfigMock,
        getStatus: vi.fn().mockResolvedValue({}),
        refreshStatus: vi.fn().mockResolvedValue(undefined),
        restartService: vi.fn().mockResolvedValue(undefined),
        updateConfigWithNotification: vi.fn().mockResolvedValue(undefined),
        restartServiceWithNotification: vi.fn().mockResolvedValue(undefined),
        setCustomWsUrl: vi.fn(),
        getWebSocketUrl: vi.fn().mockReturnValue("ws://localhost:8080"),
        changePort: vi.fn().mockResolvedValue(undefined),
        loadInitialData: vi.fn().mockResolvedValue(undefined),
        isWebSocketConnected: vi.fn().mockReturnValue(true),
        getWebSocketState: vi.fn().mockReturnValue({}),
      });

      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击保存按钮
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(updateConfigMock).toHaveBeenCalledWith(
          expect.objectContaining({
            platforms: expect.objectContaining({
              other: { token: "other-token" },
            }),
          })
        );
      });
    });

    it("点击打开魔搭社区按钮应打开外部链接", async () => {
      const mockOpen = vi.fn();
      Object.assign(window, { open: mockOpen });

      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击打开魔搭社区按钮
      const openModelscopeButton = screen.getByRole("button", {
        name: "打开魔搭社区",
      });
      await act(async () => {
        fireEvent.click(openModelscopeButton);
      });

      expect(mockOpen).toHaveBeenCalledWith(
        "https://www.modelscope.cn/my/myaccesstoken",
        "_blank"
      );
    });

    it("点击打开扣子平台按钮应打开外部链接", async () => {
      const mockOpen = vi.fn();
      Object.assign(window, { open: mockOpen });

      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击打开扣子平台按钮
      const openCozeButton = screen.getByRole("button", {
        name: "打开扣子平台",
      });
      await act(async () => {
        fireEvent.click(openCozeButton);
      });

      expect(mockOpen).toHaveBeenCalledWith(
        "https://www.coze.cn/open/oauth/sats",
        "_blank"
      );
    });
  });

  describe("表单验证边界值", () => {
    it("心跳间隔为1000时应验证通过", async () => {
      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 输入边界值1000
      const heartbeatIntervalInput =
        screen.getByPlaceholderText("心跳间隔（毫秒）");
      await act(async () => {
        fireEvent.change(heartbeatIntervalInput, { target: { value: "1000" } });
      });

      // 点击保存触发验证
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("配置已更新");
      });
    });

    it("心跳间隔为999时应显示验证错误", async () => {
      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 输入999（刚好小于1000）
      const heartbeatIntervalInput =
        screen.getByPlaceholderText("心跳间隔（毫秒）");
      await act(async () => {
        fireEvent.change(heartbeatIntervalInput, { target: { value: "999" } });
      });

      // 点击保存触发验证
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText("心跳间隔不能小于1000毫秒")
        ).toBeInTheDocument();
      });
    });
  });

  describe("保存期间状态", () => {
    it("点击保存按钮时按钮应变为加载状态", async () => {
      // 使用延迟 Promise 模拟加载状态
      let resolveUpdate!: () => void;
      vi.mocked(websocketProvider.useWebSocketActions).mockReturnValue({
        getConfig: vi.fn().mockResolvedValue(mockConfig),
        updateConfig: vi.fn().mockImplementation(() => {
          return new Promise<void>((resolve) => {
            resolveUpdate = resolve;
          });
        }),
        getStatus: vi.fn().mockResolvedValue({}),
        refreshStatus: vi.fn().mockResolvedValue(undefined),
        restartService: vi.fn().mockResolvedValue(undefined),
        updateConfigWithNotification: vi.fn().mockResolvedValue(undefined),
        restartServiceWithNotification: vi.fn().mockResolvedValue(undefined),
        setCustomWsUrl: vi.fn(),
        getWebSocketUrl: vi.fn().mockReturnValue("ws://localhost:8080"),
        changePort: vi.fn().mockResolvedValue(undefined),
        loadInitialData: vi.fn().mockResolvedValue(undefined),
        isWebSocketConnected: vi.fn().mockReturnValue(true),
        getWebSocketState: vi.fn().mockReturnValue({}),
      });

      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击保存按钮
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      // 验证按钮立即变为加载状态
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "保存中..." })
        ).toBeInTheDocument();
      });

      // 完成更新操作
      if (resolveUpdate) {
        await act(async () => {
          resolveUpdate();
        });
      }
    });

    it("点击保存按钮时取消按钮应被禁用", async () => {
      // 使用延迟 Promise 模拟加载状态
      let resolveUpdate!: () => void;
      vi.mocked(websocketProvider.useWebSocketActions).mockReturnValue({
        getConfig: vi.fn().mockResolvedValue(mockConfig),
        updateConfig: vi.fn().mockImplementation(() => {
          return new Promise<void>((resolve) => {
            resolveUpdate = resolve;
          });
        }),
        getStatus: vi.fn().mockResolvedValue({}),
        refreshStatus: vi.fn().mockResolvedValue(undefined),
        restartService: vi.fn().mockResolvedValue(undefined),
        updateConfigWithNotification: vi.fn().mockResolvedValue(undefined),
        restartServiceWithNotification: vi.fn().mockResolvedValue(undefined),
        setCustomWsUrl: vi.fn(),
        getWebSocketUrl: vi.fn().mockReturnValue("ws://localhost:8080"),
        changePort: vi.fn().mockResolvedValue(undefined),
        loadInitialData: vi.fn().mockResolvedValue(undefined),
        isWebSocketConnected: vi.fn().mockReturnValue(true),
        getWebSocketState: vi.fn().mockReturnValue({}),
      });

      render(<SystemSettingDialog />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击保存按钮
      const saveButton = screen.getByRole("button", { name: "保存" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      // 验证取消按钮被禁用
      await waitFor(() => {
        const cancelButton = screen.getByRole("button", { name: "取消" });
        expect(cancelButton).toBeDisabled();
      });

      // 完成更新操作
      if (resolveUpdate) {
        await act(async () => {
          resolveUpdate();
        });
      }
    });
  });
});
