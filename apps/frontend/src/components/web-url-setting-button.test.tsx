import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebUrlSettingButton } from "./web-url-setting-button";

// 模拟 react-hook-form
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    control: {},
    handleSubmit: vi.fn((fn) => fn),
    reset: vi.fn(),
    formState: { errors: {} },
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
        name: "test",
        ref: vi.fn(),
      },
      fieldState: { invalid: false, isTouched: false, isDirty: false },
      formState: { errors: {} },
    }),
  useFormContext: () => ({
    getFieldState: vi.fn(() => ({})),
    formState: { errors: {} },
  }),
}));

// 模拟 hooks
vi.mock("@/providers/WebSocketProvider", () => ({
  useNetworkServiceActions: () => ({
    updateConfig: vi.fn(),
    changePort: vi.fn(),
  }),
}));

vi.mock("@/stores/websocket", () => ({
  useWebSocketConnected: vi.fn(() => false),
  useWebSocketPortChangeStatus: vi.fn(() => undefined),
}));

vi.mock("@/stores/websocket-compat", () => ({
  useWebSocketConfig: vi.fn(() => ({
    webUI: {
      port: 9999,
      autoRestart: true,
    },
    mcpEndpoint: "test-endpoint",
    mcpServers: {},
  })),
}));

// 模拟 sonner toast 组件
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
  });

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
});
