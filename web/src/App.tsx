import { Toaster } from "@/components/ui/sonner";
import DashboardPage from "@/pages/DashboardPage";
import SettingsPage from "@/pages/SettingsPage";
import { WebSocketProvider } from "@/providers/WebSocketProvider";
import { Navigate, Route, Routes } from "react-router-dom";

function App() {
  return (
    <WebSocketProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <Toaster />
    </WebSocketProvider>
  );
}

export default App;
