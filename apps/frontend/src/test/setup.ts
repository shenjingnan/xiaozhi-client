import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.open
Object.defineProperty(window, "open", {
  writable: true,
  value: vi.fn(),
});

// Mock document.execCommand
Object.defineProperty(document, "execCommand", {
  value: vi.fn(),
  writable: true,
});

// Global test setup and cleanup

/**
 * 清理 DOM 中的 Radix UI 残留元素和样式
 * 移除对话框、门户、焦点守卫等元素，并重置可能导致问题的属性和样式
 */
function cleanupRadixUIRemnants(): void {
  try {
    const elementsToRemove = document.querySelectorAll("*");
    for (const el of elementsToRemove) {
      // 移除 dialog、portal 和 focus guard 元素
      if (
        el.getAttribute("role") === "dialog" ||
        el.hasAttribute("data-radix-focus-guard") ||
        el.hasAttribute("aria-hidden") ||
        el.getAttribute("data-state") === "open" ||
        (el.classList.contains("fixed") && el.classList.contains("inset-0"))
      ) {
        el.remove();
      }
      // 重置可能导致问题的属性和样式
      if (el.hasAttribute("data-scroll-locked")) {
        el.removeAttribute("data-scroll-locked");
      }
      if (el.hasAttribute("data-aria-hidden")) {
        el.removeAttribute("data-aria-hidden");
      }
      if (el.hasAttribute("aria-hidden")) {
        el.removeAttribute("aria-hidden");
      }
      if (el instanceof HTMLElement) {
        if (el.style.pointerEvents === "none") {
          el.style.pointerEvents = "auto";
        }
        if (el.style.position === "fixed") {
          el.style.position = "";
        }
        if (el.style.opacity === "0") {
          el.style.opacity = "";
        }
        if (el.style.visibility === "hidden") {
          el.style.visibility = "visible";
        }
      }
    }
  } catch (e) {
    // 清理过程中忽略错误
  }
}

beforeEach(() => {
  // Clean up clipboard before each test to avoid conflicts with userEvent.setup()
  try {
    if (navigator && "clipboard" in navigator) {
      (navigator as any).clipboard = undefined;
    }
  } catch (e) {
    // Ignore errors when cleaning up clipboard
  }

  // 强制重置 body 样式，防止 Radix UI 阻塞交互
  if (document.body) {
    // 移除所有属性
    while (document.body.attributes.length > 0) {
      document.body.removeAttribute(document.body.attributes[0].name);
    }
    // 重置关键样式
    document.body.style.cssText = "";
    document.body.style.pointerEvents = "auto";
    document.body.style.position = "";
    document.body.style.overflow = "";
    document.body.style.visibility = "visible";
    document.body.style.display = "block";

    // 强制覆盖可能的样式冲突
    const forceStyle = document.createElement("style");
    forceStyle.textContent = `
      body, body * {
        pointer-events: auto !important;
        visibility: visible !important;
        user-select: auto !important;
      }
      [data-radix-dialog-overlay] {
        display: none !important;
        pointer-events: none !important;
      }
      [data-radix-focus-guard] {
        display: none !important;
        pointer-events: none !important;
      }
      [data-scroll-locked] {
        pointer-events: auto !important;
      }
      [aria-hidden="true"] {
        pointer-events: auto !important;
      }
      .fixed.inset-0[data-state="open"] {
        display: none !important;
      }
    `;
    document.head.appendChild(forceStyle);

    // 拦截和阻止 body.style.pointerEvents = 'none'
    const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty = function (
      prop: string,
      value: string,
      priority?: string
    ) {
      // 使用类型断言来访问 parentElement
      const parentElement = (this as any).parentElement as
        | HTMLElement
        | undefined;
      if (
        prop === "pointer-events" &&
        value === "none" &&
        parentElement?.tagName === "BODY"
      ) {
        return;
      }
      return originalSetProperty.call(this, prop, value, priority);
    };

    // 也阻止直接赋值
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "pointerEvents"
    );
    if (originalDescriptor) {
      Object.defineProperty(CSSStyleDeclaration.prototype, "pointerEvents", {
        ...originalDescriptor,
        set: function (value: string) {
          if (value === "none" && this.parentElement?.tagName === "BODY") {
            return;
          }
          return originalDescriptor.set?.call(this, value) || value;
        },
      });
    }

    // 强制重置 body 的 pointer-events
    if (document.body.style) {
      document.body.style.pointerEvents = "auto";
    }
  }

  // Clean up any existing containers
  const existingRoot = document.getElementById("root");
  if (existingRoot) {
    existingRoot.innerHTML = "";
  } else {
    const root = document.createElement("div");
    root.id = "root";
    // 确保容器可以被 React 使用
    root.style.pointerEvents = "auto";
    root.style.visibility = "visible";
    root.style.position = "relative";
    document.body.appendChild(root);
  }

  const existingModalRoot = document.getElementById("modal-root");
  if (existingModalRoot) {
    existingModalRoot.innerHTML = "";
  } else {
    const modalRoot = document.createElement("div");
    modalRoot.id = "modal-root";
    // 确保容器可以被 React 使用
    modalRoot.style.pointerEvents = "auto";
    modalRoot.style.visibility = "visible";
    modalRoot.style.position = "relative";
    document.body.appendChild(modalRoot);
  }

  // 强制确保 body 和 root 容器可以被 React 找到并使用
  document.body.setAttribute("data-testid", "test-body");
  document.getElementById("root")?.setAttribute("data-testid", "test-root");
  document
    .getElementById("modal-root")
    ?.setAttribute("data-testid", "test-modal-root");

  // 清理 Radix UI 对话框、门户或焦点守卫
  cleanupRadixUIRemnants();
});

afterEach(() => {
  // 在每个测试后清理所有动态创建的元素
  cleanupRadixUIRemnants();

  // 在每个测试后重置 body 状态
  try {
    if (document.body?.attributes) {
      while (document.body.attributes.length > 0) {
        document.body.removeAttribute(document.body.attributes[0].name);
      }
      document.body.style.cssText = "";
      document.body.style.pointerEvents = "auto";
      document.body.style.position = "";
      document.body.style.overflow = "";
      document.body.style.visibility = "visible";
      document.body.style.display = "block";
    }

    // 清理动态添加的样式
    const dynamicStyles = document.querySelectorAll("style");
    for (const style of dynamicStyles) {
      if (style.textContent?.includes("pointer-events: auto !important")) {
        style.remove();
      }
    }

    // 强制重置 body 的 pointer-events
    if (document.body.style) {
      document.body.style.pointerEvents = "auto";
    }
  } catch (e) {
    // 清理过程中忽略错误
  }
});

// Simple mock for createRoot to handle test isolation issues
vi.mock("react-dom/client", () => ({
  createRoot: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));
