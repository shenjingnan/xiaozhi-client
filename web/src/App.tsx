import { Toaster } from "@/components/ui/sonner";
import DashboardPage from "@/pages/DashboardPage";
import SettingsPage from "@/pages/SettingsPage";
import { WebSocketProvider } from "@/providers/WebSocketProvider";
import { Route, Routes } from "react-router-dom";

function App() {
  return (
    <WebSocketProvider>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <Toaster />
    </WebSocketProvider>
  );
}

export default App;
