import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConfigEditor from "./ConfigEditor";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ConfigEditor", () => {
  const mockConfig = {
    mcpEndpoint: "wss://test.example.com",
    mcpServers: {},
    connection: {
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      reconnectInterval: 5000,
    },
    webUI: {
      autoRestart: true,
    },
  };

  it("should render configuration fields", () => {
    render(<ConfigEditor config={mockConfig} onChange={vi.fn()} />);

    expect(screen.getByLabelText("MCP 接入点")).toHaveValue(
      "wss://test.example.com"
    );
    expect(screen.getByLabelText("心跳间隔 (毫秒)")).toHaveValue(30000);
    expect(screen.getByLabelText("心跳超时 (毫秒)")).toHaveValue(10000);
    expect(screen.getByLabelText("重连间隔 (毫秒)")).toHaveValue(5000);
  });

  it("should call onChange when saving configuration", async () => {
    const mockOnChange = vi.fn().mockResolvedValue(undefined);
    render(<ConfigEditor config={mockConfig} onChange={mockOnChange} />);

    const saveButton = screen.getByText("保存配置");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(mockConfig);
    });

    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("配置已保存");
  });

  it("should show error toast when save fails", async () => {
    const mockOnChange = vi.fn().mockRejectedValue(new Error("保存失败"));
    render(<ConfigEditor config={mockConfig} onChange={mockOnChange} />);

    const saveButton = screen.getByText("保存配置");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("保存失败");
  });

  it("should render restart button when onRestart is provided", () => {
    render(
      <ConfigEditor
        config={mockConfig}
        onChange={vi.fn()}
        onRestart={vi.fn()}
      />
    );

    expect(screen.getByText("重启服务")).toBeInTheDocument();
  });

  it("should not render restart button when onRestart is not provided", () => {
    render(<ConfigEditor config={mockConfig} onChange={vi.fn()} />);

    expect(screen.queryByText("重启服务")).not.toBeInTheDocument();
  });

  it("should call onRestart when restart button is clicked", async () => {
    const mockOnRestart = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfigEditor
        config={mockConfig}
        onChange={vi.fn()}
        onRestart={mockOnRestart}
      />
    );

    const restartButton = screen.getByText("重启服务");
    fireEvent.click(restartButton);

    await waitFor(() => {
      expect(mockOnRestart).toHaveBeenCalled();
    });
  });

  it("should show loading state when restarting", async () => {
    const mockOnRestart = vi.fn(() => new Promise(() => {})); // Never resolves
    render(
      <ConfigEditor
        config={mockConfig}
        onChange={vi.fn()}
        onRestart={mockOnRestart}
      />
    );

    const restartButton = screen.getByText("重启服务");
    fireEvent.click(restartButton);

    await waitFor(() => {
      expect(screen.getByText("重启中...")).toBeInTheDocument();
    });
  });

  it("should show error toast when restart fails", async () => {
    const mockOnRestart = vi.fn().mockRejectedValue(new Error("重启失败"));
    render(
      <ConfigEditor
        config={mockConfig}
        onChange={vi.fn()}
        onRestart={mockOnRestart}
      />
    );

    const restartButton = screen.getByText("重启服务");
    fireEvent.click(restartButton);

    await waitFor(() => {
      expect(mockOnRestart).toHaveBeenCalled();
    });

    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("重启失败");
  });

  it("should update local config when input values change", () => {
    render(<ConfigEditor config={mockConfig} onChange={vi.fn()} />);

    const mcpEndpointInput = screen.getByLabelText("MCP 接入点");
    fireEvent.change(mcpEndpointInput, {
      target: { value: "wss://new.example.com" },
    });

    expect(mcpEndpointInput).toHaveValue("wss://new.example.com");
  });

  it("should toggle autoRestart switch", () => {
    const mockOnChange = vi.fn();
    render(<ConfigEditor config={mockConfig} onChange={mockOnChange} />);

    const autoRestartSwitch = screen.getByRole("switch", {
      name: /自动重启服务/,
    });
    expect(autoRestartSwitch).toBeChecked();

    fireEvent.click(autoRestartSwitch);

    // The switch should update local state
    expect(autoRestartSwitch).not.toBeChecked();
  });
});
