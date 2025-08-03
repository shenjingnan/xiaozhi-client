import { render, screen } from "@testing-library/react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "../App";

// Mock the dashboard page component to avoid complex dependencies
vi.mock("@/app/dashboard/page", () => ({
  default: () => <div data-testid="dashboard-page">Dashboard Page</div>,
}));

// Mock the utils import to avoid side effects
vi.mock("../utils/testInfiniteLoop", () => ({}));

function renderWithRouter(ui: React.ReactElement, initialEntries = ["//"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
  );
}

describe("App Routing", () => {
  it("renders navigation component", () => {
    renderWithRouter(<App />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("MCP Endpoint")).toBeInTheDocument();
  });

  it("renders dashboard page by default", () => {
    renderWithRouter(<App />);

    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("renders MCP Endpoint page when navigating to /mcp-endpoint", () => {
    renderWithRouter(<App />, ["/mcp-endpoint"]);

    expect(screen.getByText("xiaozhi mcp endpoint")).toBeInTheDocument();
  });

  it("shows correct navigation links", () => {
    renderWithRouter(<App />);

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    const mcpLink = screen.getByRole("link", { name: "MCP Endpoint" });

    // Links should have correct href attributes
    expect(dashboardLink).toHaveAttribute("href", "/");
    expect(mcpLink).toHaveAttribute("href", "/mcp-endpoint");
  });

  it("navigation works correctly", () => {
    renderWithRouter(<App />, ["/mcp-endpoint"]);

    // Should show MCP endpoint content
    expect(screen.getByText("xiaozhi mcp endpoint")).toBeInTheDocument();

    // Should have navigation links
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "MCP Endpoint" })
    ).toBeInTheDocument();
  });
});
