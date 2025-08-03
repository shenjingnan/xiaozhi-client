import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { AddMcpServerButton } from "./AddMcpServerButton";
import { toast } from "sonner";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    updateConfig: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/stores/websocket", () => ({
  useWebSocketConfig: () => ({
    mcpEndpoint: "wss://test.example.com",
    mcpServers: {
      "existing-server": {
        command: "node",
        args: ["existing.js"],
      },
    },
  }),
}));

describe("AddMcpServerButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(screen.getByText("添加后，需要重启服务才会生效。")).toBeInTheDocument();
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
      expect(toast.error).toHaveBeenCalledWith("配置格式错误: 请输入有效的 JSON 配置");
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
          })
        }
      });

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("服务名称冲突: 以下服务已存在: existing-server");
    });
  });

  it("should successfully add a new server", async () => {
    const mockUpdateConfig = vi.fn().mockResolvedValue(undefined);

    vi.mocked(require("@/hooks/useWebSocket").useWebSocket).mockReturnValue({
      updateConfig: mockUpdateConfig,
    });

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
          })
        }
      });

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        mcpEndpoint: "wss://test.example.com",
        mcpServers: {
          "existing-server": {
            command: "node",
            args: ["existing.js"],
          },
          "new-server": {
            command: "node",
            args: ["new.js"],
          },
        },
      });
      expect(toast.success).toHaveBeenCalledWith('已添加 MCP 服务 "new-server"');
    });
  });
});
