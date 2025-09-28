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

// Mock navigator.clipboard
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
});

// Mock document.execCommand
Object.defineProperty(document, "execCommand", {
  value: vi.fn(),
  writable: true,
});

// Global test setup and cleanup
beforeEach(() => {
  // Force cleanup of DOM state that might interfere with tests
  if (document.body?.attributes) {
    // Remove all attributes from body that might interfere with pointer events
    while (document.body.attributes.length > 0) {
      document.body.removeAttribute(document.body.attributes[0].name);
    }
    // Reset critical styles
    document.body.style.cssText = "";
    document.body.style.pointerEvents = "";
    document.body.style.position = "";
    document.body.style.overflow = "";
  }

  // Clean up any existing containers
  const existingRoot = document.getElementById("root");
  if (existingRoot) {
    existingRoot.innerHTML = "";
  } else {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
  }

  const existingModalRoot = document.getElementById("modal-root");
  if (existingModalRoot) {
    existingModalRoot.innerHTML = "";
  } else {
    const modalRoot = document.createElement("div");
    modalRoot.id = "modal-root";
    document.body.appendChild(modalRoot);
  }

  // Aggressively clean up any radix dialogs, portals, or focus guards
  try {
    const elementsToRemove = document.querySelectorAll("*");
    for (const el of elementsToRemove) {
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
          el.style.pointerEvents = "";
        }
        if (el.style.position === "fixed") {
          el.style.position = "";
        }
        if (el.style.opacity === "0") {
          el.style.opacity = "";
        }
      }
    }
  } catch (e) {
    // Ignore errors during cleanup
  }
});

afterEach(() => {
  // Clean up all dynamically created elements after each test
  try {
    const elementsToRemove = document.querySelectorAll("*");
    for (const el of elementsToRemove) {
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
          el.style.pointerEvents = "";
        }
        if (el.style.position === "fixed") {
          el.style.position = "";
        }
        if (el.style.opacity === "0") {
          el.style.opacity = "";
        }
      }
    }

    // Reset body state after each test
    if (document.body?.attributes) {
      while (document.body.attributes.length > 0) {
        document.body.removeAttribute(document.body.attributes[0].name);
      }
      document.body.style.cssText = "";
    }
  } catch (e) {
    // Ignore errors during cleanup
  }
});

// Simple mock for createRoot to handle test isolation issues
vi.mock("react-dom/client", () => ({
  createRoot: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));
