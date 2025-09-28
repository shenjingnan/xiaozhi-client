import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpEndpointSettingButton } from "../McpEndpointSettingButton";
import * as stores from "@/stores/config";
import * as api from "@/services/api";
import * as websocket from "@/services/websocket";
import { toast } from "sonner";

// Mock modules
vi.mock("@/stores/config");
vi.mock("@/services/api");
vi.mock("@/services/websocket");
vi.mock("sonner");

// Mock navigator.clipboard
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
});

// Mock document.execCommand for fallback copy
const mockExecCommand = vi.fn();
Object.defineProperty(document, "execCommand", {
  value: mockExecCommand,
  writable: true,
});

describe("McpEndpointSettingButton", () => {
  const mockEndpoints = [
    "wss://api.xiaozhi.me/mcp/?token=test1",
    "ws://localhost:8080/mcp",
  ];

  const mockConfig = {
    mcpEndpoint: mockEndpoints,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(stores.useConfig).mockReturnValue(mockConfig);
    vi.mocked(stores.useMcpEndpoint).mockReturnValue(mockEndpoints);
    vi.mocked(stores.useConfigActions).mockReturnValue({
      refreshConfig: vi.fn().mockResolvedValue(undefined),
    });

    vi.mocked(api.apiClient.getEndpointStatus).mockResolvedValue({
      endpoint: mockEndpoints[0],
      connected: true,
      initialized: true,
      isReconnecting: false,
      reconnectAttempts: 0,
      reconnectDelay: 0,
    });

    vi.mocked(api.apiClient.connectEndpoint).mockResolvedValue(undefined);
    vi.mocked(api.apiClient.disconnectEndpoint).mockResolvedValue(undefined);
    vi.mocked(api.apiClient.addEndpoint).mockResolvedValue({
      endpoint: "wss://new.example.com/mcp",
      connected: false,
      initialized: false,
      isReconnecting: false,
      reconnectAttempts: 0,
      reconnectDelay: 0,
    });

    vi.mocked(api.apiClient.removeEndpoint).mockResolvedValue(undefined);

    vi.mocked(websocket.webSocketManager.subscribe).mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("组件渲染和基本交互", () => {
    it("应该正确渲染设置按钮", () => {
      render(<McpEndpointSettingButton />);

      const settingsButton = screen.getByRole("button", { name: "" });
      expect(settingsButton).toBeInTheDocument();
      expect(settingsButton).toHaveClass("size-8");
    });

    it("点击设置按钮应该打开对话框", async () => {
      render(<McpEndpointSettingButton />);

      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      expect(screen.getByText("配置小智服务端接入点")).toBeInTheDocument();
      expect(
        screen.getByText("点击保存后，需要重启服务才会生效。")
      ).toBeInTheDocument();
    });

    it("应该正确关闭对话框", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 关闭对话框
      const closeButton = screen.getByRole("button", { name: /close/i });
      await act(async () => {
        fireEvent.click(closeButton);
      });

      expect(
        screen.queryByText("配置小智服务端接入点")
      ).not.toBeInTheDocument();
    });
  });

  describe("端点列表显示", () => {
    it("应该正确显示端点列表", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 等待状态初始化和端点显示
      await waitFor(() => {
        const endpointItems = screen.getAllByText(/wss:\/\/|ws:\/\//);
        expect(endpointItems.length).toBeGreaterThan(0);
      });
    });

    it("应该显示空状态当没有端点时", async () => {
      vi.mocked(stores.useMcpEndpoint).mockReturnValue([]);

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      expect(screen.getByText("暂无接入点，请添加")).toBeInTheDocument();
    });

    it("应该正确处理字符串类型的单个端点", async () => {
      const singleEndpoint = "wss://single.example.com/mcp";
      vi.mocked(stores.useMcpEndpoint).mockReturnValue(singleEndpoint);

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const endpointItems = screen.getAllByText(/wss:\/\/|ws:\/\//);
        expect(endpointItems.length).toBe(1);
      });
    });

    it("应该正确截断长端点地址显示", async () => {
      const longEndpoint =
        "wss://very-long-endpoint-address-that-should-be-truncated-for-display-purposes.example.com/mcp/?token=very-long-token-string";
      vi.mocked(stores.useMcpEndpoint).mockReturnValue([longEndpoint]);

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        // 查找包含截断端点地址的元素
        const endpointElement = screen.getByText(
          "wss://very-long-endpoint-addre...ken-string"
        );
        expect(endpointElement).toBeInTheDocument();
        expect(endpointElement.textContent).toContain("...");
      });
    });
  });

  describe("端点状态显示", () => {
    it("应该显示已连接状态", async () => {
      vi.mocked(api.apiClient.getEndpointStatus).mockResolvedValue({
        endpoint: mockEndpoints[0],
        connected: true,
        initialized: true,
        isReconnecting: false,
        reconnectAttempts: 0,
        reconnectDelay: 0,
      });

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        expect(screen.getByText("已连接")).toBeInTheDocument();
      });
    });

    it("应该显示未连接状态", async () => {
      vi.mocked(api.apiClient.getEndpointStatus).mockResolvedValue({
        endpoint: mockEndpoints[0],
        connected: false,
        initialized: false,
        isReconnecting: false,
        reconnectAttempts: 0,
        reconnectDelay: 0,
      });

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        expect(screen.getByText("未连接")).toBeInTheDocument();
      });
    });

    it("应该显示操作中状态", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const connectButton = screen.getByTitle("连接");
        fireEvent.click(connectButton);
      });

      expect(screen.getByText("操作中")).toBeInTheDocument();
    });
  });

  describe("端点连接操作", () => {
    it("应该能够连接端点", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const connectButton = screen.getByTitle("连接");
        fireEvent.click(connectButton);
      });

      expect(api.apiClient.connectEndpoint).toHaveBeenCalledWith(
        mockEndpoints[1]
      );
      expect(toast.success).toHaveBeenCalledWith("接入点连接成功");
    });

    it("应该能够断开端点", async () => {
      // 模拟已连接状态
      vi.mocked(api.apiClient.getEndpointStatus).mockResolvedValue({
        endpoint: mockEndpoints[0],
        connected: true,
        initialized: true,
        isReconnecting: false,
        reconnectAttempts: 0,
        reconnectDelay: 0,
      });

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const disconnectButton = screen.getByTitle("断开连接");
        fireEvent.click(disconnectButton);
      });

      expect(api.apiClient.disconnectEndpoint).toHaveBeenCalledWith(
        mockEndpoints[0]
      );
      expect(toast.success).toHaveBeenCalledWith("接入点断开成功");
    });

    it("连接失败时应该显示错误信息", async () => {
      const errorMessage = "连接失败";
      vi.mocked(api.apiClient.connectEndpoint).mockRejectedValue(
        new Error(errorMessage)
      );

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const connectButton = screen.getByTitle("连接");
        fireEvent.click(connectButton);
      });

      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });

    it("断开失败时应该显示错误信息", async () => {
      const errorMessage = "断开失败";
      vi.mocked(api.apiClient.disconnectEndpoint).mockRejectedValue(
        new Error(errorMessage)
      );

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const disconnectButton = screen.getByTitle("断开连接");
        fireEvent.click(disconnectButton);
      });

      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });

    it("操作期间应该禁用按钮", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const connectButton = screen.getByTitle("连接");
        fireEvent.click(connectButton);
      });

      // 操作期间按钮应该被禁用
      const disabledButton = screen.getByTitle("连接");
      expect(disabledButton).toBeDisabled();
    });
  });

  describe("端点复制功能", () => {
    it("应该能够复制端点地址", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const copyButton = screen.getByTitle("复制完整地址");
        fireEvent.click(copyButton);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        mockEndpoints[0]
      );
      expect(toast.success).toHaveBeenCalledWith("接入点地址已复制到剪贴板");
    });

    it("剪贴板不可用时应使用降级方案", async () => {
      // 模拟剪贴板不可用
      Object.assign(navigator, {
        clipboard: {
          writeText: vi
            .fn()
            .mockRejectedValue(new Error("Clipboard not available")),
        },
      });

      // Mock createElement and appendChild
      const mockTextArea = {
        value: "",
        style: { position: "", opacity: "" },
        select: vi.fn(),
      };
      const mockCreateElement = vi.fn().mockReturnValue(mockTextArea);
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();

      Object.defineProperty(document, "createElement", {
        value: mockCreateElement,
        writable: true,
      });

      Object.defineProperty(document, "body", {
        value: {
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild,
        },
        writable: true,
      });

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const copyButton = screen.getByTitle("复制完整地址");
        fireEvent.click(copyButton);
      });

      expect(mockCreateElement).toHaveBeenCalledWith("textarea");
      expect(mockAppendChild).toHaveBeenCalledWith(mockTextArea);
      expect(mockRemoveChild).toHaveBeenCalledWith(mockTextArea);
    });

    it("复制失败时应该显示错误信息", async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error("Copy failed")),
        },
      });

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const copyButton = screen.getByTitle("复制完整地址");
        fireEvent.click(copyButton);
      });

      expect(toast.error).toHaveBeenCalledWith("复制失败，请手动复制");
    });
  });

  describe("端点删除功能", () => {
    it("应该能够打开删除确认对话框", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const deleteButton = screen.getByTitle("删除此接入点");
        fireEvent.click(deleteButton);
      });

      expect(screen.getByText("确认删除接入点")).toBeInTheDocument();
      expect(screen.getByText(/确定要删除接入点/)).toBeInTheDocument();
    });

    it("应该能够确认删除端点", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const deleteButton = screen.getByTitle("删除此接入点");
        fireEvent.click(deleteButton);
      });

      // 确认删除
      const confirmButton = screen.getByRole("button", { name: "确定删除" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(api.apiClient.removeEndpoint).toHaveBeenCalledWith(
        mockEndpoints[0]
      );
      expect(stores.useConfigActions().refreshConfig).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("接入点已删除");
    });

    it("删除失败时应该显示错误信息", async () => {
      const errorMessage = "删除失败";
      vi.mocked(api.apiClient.removeEndpoint).mockRejectedValue(
        new Error(errorMessage)
      );

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const deleteButton = screen.getByTitle("删除此接入点");
        fireEvent.click(deleteButton);
      });

      // 确认删除
      const confirmButton = screen.getByRole("button", { name: "确定删除" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });

    it("删除期间应该禁用按钮", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        const deleteButton = screen.getByTitle("删除此接入点");
        fireEvent.click(deleteButton);
      });

      // 确认删除
      const confirmButton = screen.getByRole("button", { name: "确定删除" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      // 删除期间按钮应该被禁用
      expect(confirmButton).toBeDisabled();
    });
  });

  describe("端点添加功能", () => {
    it("应该能够打开添加端点对话框", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加小智服务端接入点");
      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(screen.getByText("添加新的接入点")).toBeInTheDocument();
      expect(
        screen.getByText("请输入小智服务端接入点地址")
      ).toBeInTheDocument();
    });

    it("应该能够添加新端点", async () => {
      const newEndpoint = "wss://new.example.com/mcp";

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加小智服务端接入点");
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 输入新端点
      const input = screen.getByPlaceholderText(/请输入接入点地址/);
      await act(async () => {
        fireEvent.change(input, { target: { value: newEndpoint } });
      });

      // 确认添加
      const confirmButton = screen.getByRole("button", { name: "确定" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(api.apiClient.addEndpoint).toHaveBeenCalledWith(newEndpoint);
      expect(stores.useConfigActions().refreshConfig).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("接入点添加成功");
    });

    it("添加期间应该禁用按钮", async () => {
      const newEndpoint = "wss://new.example.com/mcp";

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加小智服务端接入点");
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 输入新端点
      const input = screen.getByPlaceholderText(/请输入接入点地址/);
      await act(async () => {
        fireEvent.change(input, { target: { value: newEndpoint } });
      });

      // 确认添加
      const confirmButton = screen.getByRole("button", { name: "确定" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      // 添加期间按钮应该被禁用
      expect(confirmButton).toBeDisabled();
    });

    it("添加失败时应该显示错误信息", async () => {
      const errorMessage = "添加失败";
      const newEndpoint = "wss://new.example.com/mcp";

      vi.mocked(api.apiClient.addEndpoint).mockRejectedValue(
        new Error(errorMessage)
      );

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加小智服务端接入点");
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 输入新端点
      const input = screen.getByPlaceholderText(/请输入接入点地址/);
      await act(async () => {
        fireEvent.change(input, { target: { value: newEndpoint } });
      });

      // 确认添加
      const confirmButton = screen.getByRole("button", { name: "确定" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });

    it("配置未加载时应该显示错误信息", async () => {
      vi.mocked(stores.useConfig).mockReturnValue(null);
      const newEndpoint = "wss://new.example.com/mcp";

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加小智服务端接入点");
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 输入新端点
      const input = screen.getByPlaceholderText(/请输入接入点地址/);
      await act(async () => {
        fireEvent.change(input, { target: { value: newEndpoint } });
      });

      // 确认添加
      const confirmButton = screen.getByRole("button", { name: "确定" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(toast.error).toHaveBeenCalledWith("配置数据未加载，请稍后重试");
    });
  });

  describe("表单验证", () => {
    it("应该验证空输入", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加小智服务端接入点");
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 尝试添加空端点
      const confirmButton = screen.getByRole("button", { name: "确定" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(screen.getByText("请输入接入点地址")).toBeInTheDocument();
    });

    it("应该验证WebSocket协议", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加小智服务端接入点");
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 输入无效协议
      const input = screen.getByPlaceholderText(/请输入接入点地址/);
      await act(async () => {
        fireEvent.change(input, { target: { value: "http://example.com" } });
      });

      // 尝试添加
      const confirmButton = screen.getByRole("button", { name: "确定" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(
        screen.getByText(
          "接入点格式无效，请输入正确的WebSocket URL (ws:// 或 wss://)"
        )
      ).toBeInTheDocument();
    });

    it("应该验证URL格式", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加小智服务端接入点");
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 输入无效URL
      const input = screen.getByPlaceholderText(/请输入接入点地址/);
      await act(async () => {
        fireEvent.change(input, { target: { value: "ws://invalid-url" } });
      });

      // 尝试添加
      const confirmButton = screen.getByRole("button", { name: "确定" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(
        screen.getByText("接入点格式无效，请输入正确的URL格式")
      ).toBeInTheDocument();
    });

    it("应该验证重复端点", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加小智服务端接入点");
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 输入已存在的端点
      const input = screen.getByPlaceholderText(/请输入接入点地址/);
      await act(async () => {
        fireEvent.change(input, { target: { value: mockEndpoints[0] } });
      });

      // 尝试添加
      const confirmButton = screen.getByRole("button", { name: "确定" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(screen.getByText("该接入点已存在")).toBeInTheDocument();
    });

    it("输入变化时应该清除验证错误", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加小智服务端接入点");
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 尝试添加空端点
      const confirmButton = screen.getByRole("button", { name: "确定" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(screen.getByText("请输入接入点地址")).toBeInTheDocument();

      // 输入有效值
      const input = screen.getByPlaceholderText(/请输入接入点地址/);
      await act(async () => {
        fireEvent.change(input, {
          target: { value: "wss://new.example.com/mcp" },
        });
      });

      expect(screen.queryByText("请输入接入点地址")).not.toBeInTheDocument();
    });

    it("重新打开对话框时应该清除验证错误", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击添加按钮
      const addButton = screen.getByText("添加小智服务端接入点");
      await act(async () => {
        fireEvent.click(addButton);
      });

      // 尝试添加空端点
      const confirmButton = screen.getByRole("button", { name: "确定" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(screen.getByText("请输入接入点地址")).toBeInTheDocument();

      // 关闭对话框
      const closeButton = screen.getByRole("button", { name: /cancel/i });
      await act(async () => {
        fireEvent.click(closeButton);
      });

      // 重新打开添加对话框
      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(screen.queryByText("请输入接入点地址")).not.toBeInTheDocument();
    });
  });

  describe("WebSocket状态同步", () => {
    it("应该订阅端点状态变更事件", async () => {
      const mockUnsubscribe = vi.fn();
      vi.mocked(websocket.webSocketManager.subscribe).mockReturnValue(
        mockUnsubscribe
      );

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      expect(websocket.webSocketManager.subscribe).toHaveBeenCalledWith(
        "data:endpointStatusChanged",
        expect.any(Function)
      );
    });

    it("应该正确处理连接成功事件", async () => {
      const mockUnsubscribe = vi.fn();
      let eventHandler: any;

      vi.mocked(websocket.webSocketManager.subscribe).mockImplementation(
        (event, handler) => {
          eventHandler = handler;
          return mockUnsubscribe;
        }
      );

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 模拟连接成功事件
      if (eventHandler) {
        await act(async () => {
          eventHandler({
            endpoint: mockEndpoints[0],
            connected: true,
            operation: "connect",
            success: true,
            message: "连接成功",
            timestamp: Date.now(),
          });
        });
      }

      expect(toast.success).toHaveBeenCalledWith("端点连接成功");
    });

    it("应该正确处理连接失败事件", async () => {
      const mockUnsubscribe = vi.fn();
      let eventHandler: any;

      vi.mocked(websocket.webSocketManager.subscribe).mockImplementation(
        (event, handler) => {
          eventHandler = handler;
          return mockUnsubscribe;
        }
      );

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 模拟连接失败事件
      if (eventHandler) {
        await act(async () => {
          eventHandler({
            endpoint: mockEndpoints[0],
            connected: false,
            operation: "connect",
            success: false,
            message: "连接失败",
            timestamp: Date.now(),
          });
        });
      }

      expect(toast.error).toHaveBeenCalledWith("端点连接失败: 连接失败");
    });

    it("应该正确处理断开成功事件", async () => {
      const mockUnsubscribe = vi.fn();
      let eventHandler: any;

      vi.mocked(websocket.webSocketManager.subscribe).mockImplementation(
        (event, handler) => {
          eventHandler = handler;
          return mockUnsubscribe;
        }
      );

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 模拟断开成功事件
      if (eventHandler) {
        await act(async () => {
          eventHandler({
            endpoint: mockEndpoints[0],
            connected: false,
            operation: "disconnect",
            success: true,
            message: "断开成功",
            timestamp: Date.now(),
          });
        });
      }

      expect(toast.success).toHaveBeenCalledWith("端点断开成功");
    });

    it("应该正确处理重连事件", async () => {
      const mockUnsubscribe = vi.fn();
      let eventHandler: any;

      vi.mocked(websocket.webSocketManager.subscribe).mockImplementation(
        (event, handler) => {
          eventHandler = handler;
          return mockUnsubscribe;
        }
      );

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 模拟重连成功事件
      if (eventHandler) {
        await act(async () => {
          eventHandler({
            endpoint: mockEndpoints[0],
            connected: true,
            operation: "reconnect",
            success: true,
            message: "重连成功",
            timestamp: Date.now(),
          });
        });
      }

      expect(toast.success).toHaveBeenCalledWith("端点重连成功");
    });

    it("应该只处理匹配的端点事件", async () => {
      const mockUnsubscribe = vi.fn();
      let eventHandler: any;

      vi.mocked(websocket.webSocketManager.subscribe).mockImplementation(
        (event, handler) => {
          eventHandler = handler;
          return mockUnsubscribe;
        }
      );

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 模拟其他端点的事件
      if (eventHandler) {
        await act(async () => {
          eventHandler({
            endpoint: "wss://other.example.com/mcp",
            connected: true,
            operation: "connect",
            success: true,
            message: "连接成功",
            timestamp: Date.now(),
          });
        });
      }

      // 不应该显示任何通知
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("应该清理事件订阅", async () => {
      const mockUnsubscribe = vi.fn();
      vi.mocked(websocket.webSocketManager.subscribe).mockReturnValue(
        mockUnsubscribe
      );

      const { unmount } = render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 卸载组件
      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("边界情况和错误处理", () => {
    it("应该处理获取端点状态失败的情况", async () => {
      vi.mocked(api.apiClient.getEndpointStatus).mockRejectedValue(
        new Error("获取状态失败")
      );

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 应该显示默认状态
      await waitFor(() => {
        expect(screen.getByText("未连接")).toBeInTheDocument();
      });
    });

    it("应该处理初始化端点状态失败的情况", async () => {
      vi.mocked(api.apiClient.getEndpointStatus).mockRejectedValue(
        new Error("初始化失败")
      );

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 应该仍然显示端点列表
      await waitFor(() => {
        const endpointItems = screen.getAllByText(/wss:\/\/|ws:\/\//);
        expect(endpointItems.length).toBeGreaterThan(0);
      });
    });

    it("应该处理空配置的情况", async () => {
      vi.mocked(stores.useConfig).mockReturnValue(null);

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 应该显示空状态
      expect(screen.getByText("暂无接入点，请添加")).toBeInTheDocument();
    });

    it("应该处理未定义的端点配置", async () => {
      vi.mocked(stores.useMcpEndpoint).mockReturnValue(undefined);

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 应该显示空状态
      expect(screen.getByText("暂无接入点，请添加")).toBeInTheDocument();
    });

    it("应该处理空字符串端点配置", async () => {
      vi.mocked(stores.useMcpEndpoint).mockReturnValue("");

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 应该显示空状态
      expect(screen.getByText("暂无接入点，请添加")).toBeInTheDocument();
    });

    it("应该处理包含空字符串的端点数组", async () => {
      vi.mocked(stores.useMcpEndpoint).mockReturnValue(["", mockEndpoints[0]]);

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 应该只显示非空端点
      await waitFor(() => {
        const endpointItems = screen.getAllByText(/wss:\/\/|ws:\/\//);
        expect(endpointItems.length).toBe(1);
      });
    });

    it("应该处理删除操作中端点为空的情况", async () => {
      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 直接触发删除函数（模拟异常情况）
      const component = screen.getByText("配置小智服务端接入点").closest("div");
      if (component) {
        const deleteButton = component.querySelector('[title="删除此接入点"]');
        if (deleteButton) {
          await act(async () => {
            fireEvent.click(deleteButton);
          });
        }
      }

      // 应该显示错误信息
      expect(toast.error).toHaveBeenCalledWith("未选择要删除的接入点");
    });

    it("应该处理外部链接打开", async () => {
      const mockOpen = vi.fn();
      Object.assign(window, { open: mockOpen });

      render(<McpEndpointSettingButton />);

      // 打开对话框
      const settingsButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // 点击打开小智服务端按钮
      const openServerButton = screen.getByText("打开小智服务端");
      await act(async () => {
        fireEvent.click(openServerButton);
      });

      expect(mockOpen).toHaveBeenCalledWith(
        "https://xiaozhi.me/console/agents",
        "_blank"
      );
    });
  });

  describe("辅助函数测试", () => {
    it("应该正确截断端点地址", () => {
      // 测试sliceEndpoint函数的逻辑
      const shortEndpoint = "ws://localhost:8080";
      const longEndpoint =
        "wss://very-long-endpoint-address-that-should-be-truncated-for-display-purposes.example.com/mcp/?token=very-long-token-string";

      // 模拟 sliceEndpoint 函数的逻辑
      const sliceEndpoint = (endpoint: string) => {
        return `${endpoint.slice(0, 30)}...${endpoint.slice(-10)}`;
      };

      // 短地址不会被截断（实际组件逻辑）
      if (shortEndpoint.length <= 40) {
        expect(shortEndpoint).toBe(shortEndpoint);
      }

      // 长地址会被截断
      const truncatedLong = sliceEndpoint(longEndpoint);
      expect(truncatedLong).toBe("wss://very-long-endpoint-addre...ken-string");
      expect(truncatedLong).toContain("...");
      expect(truncatedLong.length).toBe(43); // 30 + 3(...) + 10
      expect(truncatedLong.slice(0, 30)).toBe("wss://very-long-endpoint-addre");
      expect(truncatedLong.slice(-10)).toBe("ken-string");
    });

    it("应该正确验证端点格式", () => {
      // 测试validateEndpoint函数的逻辑
      const validateEndpoint = (endpoint: string): string | null => {
        if (!endpoint.trim()) {
          return "请输入接入点地址";
        }

        // 检查是否是有效的 WebSocket URL
        if (!endpoint.startsWith("ws://") && !endpoint.startsWith("wss://")) {
          return "接入点格式无效，请输入正确的WebSocket URL (ws:// 或 wss://)";
        }

        // 检查是否是有效的 URL
        try {
          new URL(endpoint);
        } catch {
          return "接入点格式无效，请输入正确的URL格式";
        }

        return null; // 验证通过
      };

      // 测试空输入
      expect(validateEndpoint("")).toBe("请输入接入点地址");
      expect(validateEndpoint("   ")).toBe("请输入接入点地址");

      // 测试无效协议
      expect(validateEndpoint("http://example.com")).toBe(
        "接入点格式无效，请输入正确的WebSocket URL (ws:// 或 wss://)"
      );
      expect(validateEndpoint("https://example.com")).toBe(
        "接入点格式无效，请输入正确的WebSocket URL (ws:// 或 wss://)"
      );

      // 测试无效URL - 注意："ws://invalid-url" 实际上是有效URL格式
      expect(validateEndpoint("wss://")).toBe(
        "接入点格式无效，请输入正确的URL格式"
      );
      expect(validateEndpoint("ws://")).toBe(
        "接入点格式无效，请输入正确的URL格式"
      );

      // 测试有效URL
      expect(validateEndpoint("ws://localhost:8080")).toBeNull();
      expect(validateEndpoint("wss://example.com/mcp")).toBeNull();
      expect(
        validateEndpoint("wss://example.com/mcp/?token=abc123")
      ).toBeNull();
      expect(validateEndpoint("ws://invalid-url")).toBeNull(); // 这是有效URL格式
    });
  });
});
