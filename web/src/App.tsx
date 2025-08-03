import { Toaster } from "@/components/ui/sonner";
import DashboardPage from "@/pages/DashboardPage";
import McpEndpointPage from "@/pages/McpEndpointPage";
import { PortTestPage } from "@/pages/PortTestPage";
import SettingsPage from "@/pages/SettingsPage";
import { Route, Routes } from "react-router-dom";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/mcp-endpoint" element={<McpEndpointPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/port-test" element={<PortTestPage />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
