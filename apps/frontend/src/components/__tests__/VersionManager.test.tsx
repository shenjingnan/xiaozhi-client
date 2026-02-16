/**
 * VersionManager 组件测试
 */

import { VersionManager } from "@/components/version-manager";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock API client
vi.mock("../../services/api", () => ({
  apiClient: {
    getVersion: vi.fn().mockResolvedValue({
      name: "xiaozhi-client",
      version: "1.0.0",
      description: "Test application",
      author: "Test Author",
    }),
  },
}));

// Mock useNPMInstall hook
vi.mock("../../hooks/useNPMInstall", () => ({
  useNPMInstall: () => ({
    installStatus: {
      status: "idle",
      logs: [],
    },
    startInstall: vi.fn(),
    clearStatus: vi.fn(),
    getStatusText: () => "",
    getStatusColor: () => "",
    isInstalling: () => false,
    canCloseDialog: () => true,
  }),
}));

describe("VersionManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该渲染版本管理标题", async () => {
    render(<VersionManager />);

    await waitFor(() => {
      expect(screen.getByText("版本管理")).toBeInTheDocument();
    });
  });

  it("应该显示版本信息", async () => {
    render(<VersionManager />);

    await waitFor(() => {
      expect(screen.getByText("版本 1.0.0")).toBeInTheDocument();
    });
  });

  it("应该有检查更新按钮", async () => {
    render(<VersionManager />);

    await waitFor(() => {
      const checkButton = screen.getByRole("button", { name: /检查更新/i });
      expect(checkButton).toBeInTheDocument();
    });
  });

  it("应该显示当前版本信息卡片", async () => {
    render(<VersionManager />);

    await waitFor(() => {
      expect(screen.getByText("当前版本")).toBeInTheDocument();
      expect(screen.getByText("Test application")).toBeInTheDocument();
      expect(screen.getByText("作者: Test Author")).toBeInTheDocument();
    });
  });
});
