import { mcpServerApi } from "@/services/api";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddMcpServerButton } from "./AddMcpServerButton";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock mcpServerApi
const mockListServers = vi.fn();
const mockAddServer = vi.fn();

vi.mock("@/services/api", () => ({
  mcpServerApi: {
    listServers: vi.fn(),
    addServer: vi.fn(),
  },
}));

// Mock useConfig
vi.mock("@/stores/config", () => ({
  useConfig: () => ({
    mcpEndpoint: "wss://test.example.com",
    mcpServers: {
      "existing-server": {
        command: "node",
        args: ["existing.js"],
      },
    },
    connection: {
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      reconnectInterval: 5000,
    },
  }),
}));

describe("添加MCP服务器按钮", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListServers.mockClear();
    mockAddServer.mockClear();

    // Setup default mocks
    mockListServers.mockResolvedValue({
      servers: [
        {
          name: "existing-server",
          config: { command: "node", args: ["existing.js"] },
        },
      ],
    });
    mockAddServer.mockResolvedValue({
      name: "new-server",
      status: "added",
    });

    // Assign mocks to the imported module
    (mcpServerApi.listServers as any) = mockListServers;
    (mcpServerApi.addServer as any) = mockAddServer;
  });

  it("应该渲染添加按钮", () => {
    render(<AddMcpServerButton />);

    const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
    expect(addButton).toBeInTheDocument();
  });

  it("点击按钮时应该打开对话框", async () => {
    render(<AddMcpServerButton />);

    const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByText("添加后，需要重启服务才会生效。")
      ).toBeInTheDocument();
    });
  });

  it("对于无效JSON应该显示错误", async () => {
    render(<AddMcpServerButton />);

    const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
    fireEvent.click(addButton);

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "invalid json" } });

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("JSON 格式错误")
      );
    });
  });

  it("对于重复的服务器名称应该显示错误", async () => {
    render(<AddMcpServerButton />);

    const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
    fireEvent.click(addButton);

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, {
        target: {
          value: JSON.stringify({
            mcpServers: {
              "existing-server": {
                command: "node",
                args: ["new.js"],
              },
            },
          }),
        },
      });

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "服务名称冲突: 以下服务已存在: existing-server"
      );
    });
  });

  it("应该成功添加新的stdio服务器", async () => {
    render(<AddMcpServerButton />);

    const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
    fireEvent.click(addButton);

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, {
        target: {
          value: JSON.stringify({
            mcpServers: {
              "new-server": {
                command: "node",
                args: ["new.js"],
              },
            },
          }),
        },
      });

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockListServers).toHaveBeenCalled();
      expect(mockAddServer).toHaveBeenCalledWith("new-server", {
        command: "node",
        args: ["new.js"],
      });
      expect(toast.success).toHaveBeenCalledWith(
        '已添加 MCP 服务 "new-server"'
      );
    });
  });

  it("应该成功添加新的SSE服务器", async () => {
    render(<AddMcpServerButton />);

    const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
    fireEvent.click(addButton);

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, {
        target: {
          value: JSON.stringify({
            mcpServers: {
              "sse-server": {
                type: "sse",
                url: "https://example.com/sse",
              },
            },
          }),
        },
      });

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockListServers).toHaveBeenCalled();
      expect(mockAddServer).toHaveBeenCalledWith("sse-server", {
        type: "sse",
        url: "https://example.com/sse",
      });
      expect(toast.success).toHaveBeenCalledWith(
        '已添加 MCP 服务 "sse-server"'
      );
    });
  });

  it("应该成功添加带有类型的新streamable-http服务器", async () => {
    render(<AddMcpServerButton />);

    const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
    fireEvent.click(addButton);

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, {
        target: {
          value: JSON.stringify({
            mcpServers: {
              "http-server": {
                url: "https://example.com/mcp",
              },
            },
          }),
        },
      });

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockListServers).toHaveBeenCalled();
      expect(mockAddServer).toHaveBeenCalledWith("http-server", {
        url: "https://example.com/mcp",
      });
      expect(toast.success).toHaveBeenCalledWith(
        '已添加 MCP 服务 "http-server"'
      );
    });
  });

  it("应该成功添加没有类型的新streamable-http服务器", async () => {
    render(<AddMcpServerButton />);

    const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
    fireEvent.click(addButton);

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, {
        target: {
          value: JSON.stringify({
            mcpServers: {
              "http-server-no-type": {
                url: "https://example.com/mcp",
              },
            },
          }),
        },
      });

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockListServers).toHaveBeenCalled();
      expect(mockAddServer).toHaveBeenCalledWith("http-server-no-type", {
        url: "https://example.com/mcp",
      });
      expect(toast.success).toHaveBeenCalledWith(
        '已添加 MCP 服务 "http-server-no-type"'
      );
    });
  });

  describe("字段验证", () => {
    it("对于缺少命令的stdio服务器应该显示错误", async () => {
      render(<AddMcpServerButton />);

      const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
      fireEvent.click(addButton);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        fireEvent.change(textarea, {
          target: {
            value: JSON.stringify({
              mcpServers: {
                "invalid-server": {
                  args: ["test.js"],
                },
              },
            }),
          },
        });

        const saveButton = screen.getByRole("button", { name: /保存/ });
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining(
            "必须包含 command 字段（stdio）、type: 'sse' 字段（sse）或 url 字段（streamable-http）"
          )
        );
      });
    });

    it("对于参数无效的stdio服务器应该显示错误", async () => {
      render(<AddMcpServerButton />);

      const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
      fireEvent.click(addButton);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        fireEvent.change(textarea, {
          target: {
            value: JSON.stringify({
              mcpServers: {
                "invalid-server": {
                  command: "node",
                  args: "not-an-array",
                },
              },
            }),
          },
        });

        const saveButton = screen.getByRole("button", { name: /保存/ });
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("的 args 字段必须是数组")
        );
      });
    });

    it("对于缺少URL的SSE服务器应该显示错误", async () => {
      render(<AddMcpServerButton />);

      const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
      fireEvent.click(addButton);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        fireEvent.change(textarea, {
          target: {
            value: JSON.stringify({
              mcpServers: {
                "invalid-sse": {
                  type: "sse",
                },
              },
            }),
          },
        });

        const saveButton = screen.getByRole("button", { name: /保存/ });
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("缺少必需的 url 字段或字段类型不正确")
        );
      });
    });

    it("应该处理没有mcpServers包装器的单服务器配置", async () => {
      render(<AddMcpServerButton />);

      const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
      fireEvent.click(addButton);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        fireEvent.change(textarea, {
          target: {
            value: JSON.stringify({
              url: "https://example.com/mcp",
            }),
          },
        });

        const saveButton = screen.getByRole("button", { name: /保存/ });
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockListServers).toHaveBeenCalled();
        expect(mockAddServer).toHaveBeenCalledWith("http-server", {
          url: "https://example.com/mcp",
        });
        expect(toast.success).toHaveBeenCalledWith(
          '已添加 MCP 服务 "http-server"'
        );
      });
    });
  });
});
