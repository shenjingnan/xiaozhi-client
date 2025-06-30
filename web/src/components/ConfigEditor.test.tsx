import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../types";
import ConfigEditor from "./ConfigEditor";

describe("ConfigEditor", () => {
  const mockConfig: AppConfig = {
    mcpEndpoint: "wss://test.endpoint",
    mcpServers: {},
    connection: {
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      reconnectInterval: 5000,
    },
    modelscope: {
      apiKey: "test-key",
    },
  };

  const mockOnChange = vi.fn();

  it("renders all config fields", () => {
    render(<ConfigEditor config={mockConfig} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue("wss://test.endpoint")).toBeInTheDocument();
    expect(screen.getByDisplayValue("30000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("test-key")).toBeInTheDocument();
  });

  it("updates mcpEndpoint field", async () => {
    render(<ConfigEditor config={mockConfig} onChange={mockOnChange} />);

    const input = screen.getByDisplayValue("wss://test.endpoint");
    fireEvent.change(input, { target: { value: "wss://new.endpoint" } });

    const saveButton = screen.getByText("保存配置");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        mcpEndpoint: "wss://new.endpoint",
      });
    });
  });

  it("updates connection config fields", async () => {
    render(<ConfigEditor config={mockConfig} onChange={mockOnChange} />);

    const heartbeatInput = screen.getByDisplayValue("30000");
    fireEvent.change(heartbeatInput, { target: { value: "60000" } });

    const saveButton = screen.getByText("保存配置");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        connection: {
          ...mockConfig.connection,
          heartbeatInterval: 60000,
        },
      });
    });
  });

  it("handles config without optional fields", () => {
    const minimalConfig: AppConfig = {
      mcpEndpoint: "wss://test.endpoint",
      mcpServers: {},
    };

    render(<ConfigEditor config={minimalConfig} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue("wss://test.endpoint")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("ModelScope API Key")
    ).not.toBeInTheDocument();
  });
});
