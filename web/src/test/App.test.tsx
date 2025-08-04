import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "../App";

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  send(_data: string) {}
  close() {}
}

global.WebSocket = MockWebSocket as any;

// Mock the dashboard page component to avoid complex dependencies
vi.mock("@/pages/DashboardPage", () => ({
  default: () => <div data-testid="dashboard-page">Dashboard Page</div>,
}));

// Mock the settings page component to avoid complex dependencies
vi.mock("@/pages/SettingsPage", () => ({
  default: () => <div data-testid="settings-page">Settings Page</div>,
}));

// Mock the utils import to avoid side effects
vi.mock("../utils/testInfiniteLoop", () => ({}));

function renderWithRouter(ui: React.ReactElement, initialEntries = ["//"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
  );
}

describe("App Routing", () => {
  it("renders dashboard page by default", () => {
    renderWithRouter(<App />);

    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("renders Settings page when navigating to /settings", () => {
    renderWithRouter(<App />, ["/settings"]);

    expect(screen.getByTestId("settings-page")).toBeInTheDocument();
  });

  it("renders dashboard page for root path", () => {
    renderWithRouter(<App />, ["/"]);

    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("includes Toaster component", () => {
    renderWithRouter(<App />);

    // Toaster creates a section with aria-label for notifications
    expect(screen.getByLabelText("Notifications alt+T")).toBeInTheDocument();
  });

  it("wraps content in WebSocketProvider", () => {
    renderWithRouter(<App />);

    // If WebSocketProvider is working, the page should render without errors
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });
});
