import DashboardPage from "@/app/dashboard/page";
import { Toaster } from "@/components/ui/sonner";
import { Route, Routes } from "react-router-dom";
import McpEndpoint from "./pages/McpEndpoint";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/mcp-endpoint" element={<McpEndpoint />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
