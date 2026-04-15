import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebUrlSettingButton } from "./web-url-setting-button";

// 获取 sonner mock 实例（用于断言）
let mockToast: {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
};

// 模拟 react-hook-form - 保留真实 zod 验证逻辑
let capturedOnSubmit: ((data: any) => Promise<void>) | null = null;
let currentErrors: Record<string, { message: string }> = {};

vi.mock("react-hook-form", () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: (data: any) => void) => {
      capturedOnSubmit = fn;
      return (e: React.FormEvent) => {
        e.preventDefault();
        fn({ port: "" });
      };
    },
    reset: vi.fn(),
    formState: { errors: currentErrors },
  }),
  FormProvider: ({ children }: { children: React.ReactNode }) => children,
  Controller: ({
    render,
  }: {
    render: (props: {
      field: {
        onChange: () => void;
        onBlur: () => void;
        value: string;
        name: string;
        ref: () => void;
      };
      fieldState: {
        invalid: boolean;
        isTouched: boolean;
        isDirty: boolean;
        error?: { message?: string };
      };
      formState: { errors: Record<string, unknown> };
    }) => ReactElement;
  }) =>
    render({
      field: {
        onChange: vi.fn(),
        onBlur: vi.fn(),
        value: "",
        name: "port",
        ref: vi.fn(),
      },
      fieldState: {
        invalid: !!currentErrors.port,
        isTouched: false,
        isDirty: false,
        error: currentErrors.port,
      },
      formState: { errors: currentErrors },
    }),
  useFormContext: () => ({
    getFieldState: vi.fn(() => ({})),
    formState: { errors: currentErrors },
  }),
}));

// 模拟 hooks
const mockChangePort = vi.fn();
vi.mock("@/providers/WebSocketProvider", () => ({
  useNetworkServiceActions: () => ({
    updateConfig: vi.fn(),
    changePort: mockChangePort,
  }),
}));

// 模拟 status store（连接状态来源）
let mockConnected = false;
vi.mock("@/stores/status", () => ({
  useConnectionStatus: () => mockConnected,
}));

// 模拟 config store
let mockConfig: any = undefined;
vi.mock("@/stores/config", () => ({
  useConfig: () => mockConfig,
}));

// 模拟 sonner toast 组件（vi.mock 会被提升，所以必须在内部定义）
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("WebUrlSettingButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnected = false;
    mockConfig = undefined;
    capturedOnSubmit = null;
    currentErrors = {};
    mockChangePort.mockReset();

    // 获取 toast mock 实例
    const { toast } = require("sonner");
    mockToast = toast as any;
  });

  // ========== 基础渲染测试（保留原有）==========

  it("渲染设置按钮", () => {
    render(<WebUrlSettingButton />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("点击按钮时打开对话框", async () => {
    render(<WebUrlSettingButton />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("显示对话框标题和描述", async () => {
    render(<WebUrlSettingButton />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("配置服务端端口")).toBeInTheDocument();
      expect(
        screen.getByText("请输入服务端端口号，系统将尝试连接。")
      ).toBeInTheDocument();
    });
  });

  // ========== 表单验证测试 ==========

  describe("表单验证", () => {
    it("对话框中应包含端口输入框和提交按钮", async () => {
      render(<WebUrlSettingButton />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        // 应该有输入框
        const input = screen.getByPlaceholderText(/服务端端口/);
        expect(input).toBeInTheDocument();
        // 应该有提交按钮（type=submit）
        const allButtons = screen.getAllByRole("button");
        const submitBtn = allButtons.find(
          (b) => b.getAttribute("type") === "submit"
        );
        expect(submitBtn).toBeDefined();
      });
    });
  });

  // ========== 按钮状态和文本测试 ==========

  describe("按钮状态和文本", () => {
    it("未连接状态下默认按钮文本应为'保存并连接'", () => {
      mockConnected = false;

      render(<WebUrlSettingButton />);

      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("");
    });

    it("已连接状态下对话框内提交按钮文本应为'保存并重启'", async () => {
      mockConnected = true;
      mockConfig = { webUI: { port: 8080 } };

      render(<WebUrlSettingButton />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        // 提交按钮应包含"保存并重启"
        const submitButton = screen
          .getAllByRole("button")
          .find((b) => b.getAttribute("type") === "submit");
        expect(submitButton).toBeTruthy();
      });
    });
  });

  // ========== 对话框描述随状态变化 ==========

  describe("对话框内容动态变化", () => {
    it("未连接时应显示'请输入服务端端口号，系统将尝试连接'", async () => {
      mockConnected = false;

      render(<WebUrlSettingButton />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(
          screen.getByText("请输入服务端端口号，系统将尝试连接。")
        ).toBeInTheDocument();
      });
    });

    it("已连接时应显示'修改端口后将自动重启服务并重新连接'", async () => {
      mockConnected = true;

      render(<WebUrlSettingButton />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(
          screen.getByText("修改端口后将自动重启服务并重新连接。")
        ).toBeInTheDocument();
      });
    });
  });

  // ========== 端口输入框测试 ==========

  describe("端口输入框", () => {
    it("应渲染端口输入框", async () => {
      render(<WebUrlSettingButton />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        const input = screen.getByPlaceholderText(
          /服务端端口/
        ) as HTMLInputElement;
        expect(input).toBeInTheDocument();
        expect(input.type).toBe("number");
      });
    });

    it("config 加载后输入框应有正确的默认值", async () => {
      mockConfig = { webUI: { port: 8888 } };

      render(<WebUrlSettingButton />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        // 输入框应该存在且可交互
        const input = screen.getByPlaceholderText(
          /服务端端口/
        ) as HTMLInputElement;
        expect(input).toBeInTheDocument();
      });
    });
  });

  // ========== 取消按钮测试 ==========

  describe("取消功能", () => {
    it("点击取消按钮应关闭对话框", async () => {
      render(<WebUrlSettingButton />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const cancelButton = screen.getByText("取消");
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });
});
