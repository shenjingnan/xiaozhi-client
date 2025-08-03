import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";

export function Navigation() {
  const location = useLocation();

  return (
    <nav className="flex gap-4 p-4 border-b">
      <Button
        variant={location.pathname === "/" ? "default" : "outline"}
        asChild
      >
        <Link to="/">Dashboard</Link>
      </Button>
      <Button
        variant={location.pathname === "/mcp-endpoint" ? "default" : "outline"}
        asChild
      >
        <Link to="/mcp-endpoint">MCP Endpoint</Link>
      </Button>
    </nav>
  );
}
