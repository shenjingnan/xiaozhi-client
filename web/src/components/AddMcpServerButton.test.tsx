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

const mockUpdateConfig = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    updateConfig: mockUpdateConfig,
  }),
}));

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

describe("AddMcpServerButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateConfig.mockClear();
  });

  it("should render the add button", () => {
    render(<AddMcpServerButton />);

    const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
    expect(addButton).toBeInTheDocument();
  });

  it("should open dialog when button is clicked", async () => {
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

  it("should show error for invalid JSON", async () => {
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

  it("should show error for duplicate server names", async () => {
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

  it("should successfully add a new stdio server", async () => {
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
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpEndpoint: "wss://test.example.com",
          mcpServers: expect.objectContaining({
            "existing-server": {
              command: "node",
              args: ["existing.js"],
            },
            "new-server": {
              command: "node",
              args: ["new.js"],
            },
          }),
        })
      );
      expect(toast.success).toHaveBeenCalledWith(
        '已添加 MCP 服务 "new-server"'
      );
    });
  });

  it("should successfully add a new SSE server", async () => {
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
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpEndpoint: "wss://test.example.com",
          mcpServers: expect.objectContaining({
            "existing-server": {
              command: "node",
              args: ["existing.js"],
            },
            "sse-server": {
              type: "sse",
              url: "https://example.com/sse",
            },
          }),
        })
      );
      expect(toast.success).toHaveBeenCalledWith(
        '已添加 MCP 服务 "sse-server"'
      );
    });
  });

  it("should successfully add a new streamable-http server with type", async () => {
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
                type: "streamable-http",
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
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpEndpoint: "wss://test.example.com",
          mcpServers: expect.objectContaining({
            "existing-server": {
              command: "node",
              args: ["existing.js"],
            },
            "http-server": {
              type: "streamable-http",
              url: "https://example.com/mcp",
            },
          }),
        })
      );
      expect(toast.success).toHaveBeenCalledWith(
        '已添加 MCP 服务 "http-server"'
      );
    });
  });

  it("should successfully add a new streamable-http server without type", async () => {
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
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpEndpoint: "wss://test.example.com",
          mcpServers: expect.objectContaining({
            "existing-server": {
              command: "node",
              args: ["existing.js"],
            },
            "http-server-no-type": {
              url: "https://example.com/mcp",
            },
          }),
        })
      );
      expect(toast.success).toHaveBeenCalledWith(
        '已添加 MCP 服务 "http-server-no-type"'
      );
    });
  });

  describe("Field validation", () => {
    it("should show error for stdio server missing command", async () => {
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
          expect.stringContaining("必须包含 command 字段")
        );
      });
    });

    it("should show error for stdio server with invalid args", async () => {
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
          expect.stringContaining("args 字段必须是数组")
        );
      });
    });

    it("should show error for SSE server missing url", async () => {
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
          expect.stringContaining("缺少必需的 url 字段")
        );
      });
    });

    it("should show error for streamable-http server missing url", async () => {
      render(<AddMcpServerButton />);

      const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
      fireEvent.click(addButton);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        fireEvent.change(textarea, {
          target: {
            value: JSON.stringify({
              mcpServers: {
                "invalid-http": {
                  type: "streamable-http",
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
          expect.stringContaining("必须包含 command 字段")
        );
      });
    });

    it("should show error for streamable-http server with invalid type", async () => {
      render(<AddMcpServerButton />);

      const addButton = screen.getByRole("button", { name: /添加MCP服务/ });
      fireEvent.click(addButton);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        fireEvent.change(textarea, {
          target: {
            value: JSON.stringify({
              mcpServers: {
                "invalid-http": {
                  type: "invalid-type",
                  url: "https://example.com",
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
          expect.stringContaining("type 字段如果存在，必须是")
        );
      });
    });

    it("should handle single server config without mcpServers wrapper", async () => {
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
        expect(mockUpdateConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            mcpEndpoint: "wss://test.example.com",
            mcpServers: expect.objectContaining({
              "existing-server": {
                command: "node",
                args: ["existing.js"],
              },
              "http-server": {
                url: "https://example.com/mcp",
              },
            }),
          })
        );
        expect(toast.success).toHaveBeenCalledWith(
          '已添加 MCP 服务 "http-server"'
        );
      });
    });
  });
});
