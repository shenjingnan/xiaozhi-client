import { Toaster } from "@/components/ui/sonner";
import DashboardPage from "@/pages/DashboardPage";
import SettingsPage from "@/pages/SettingsPage";
import { WebSocketProvider } from "@/providers/WebSocketProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Navigate, Route, Routes } from "react-router-dom";

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <WebSocketProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
          <Toaster />
        </WebSocketProvider>
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;
