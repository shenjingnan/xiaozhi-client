import { Toaster } from "@/components/ui/sonner";
import DashboardPage from "@/app/dashboard/page";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <>
      <DashboardPage />
      <div className="min-h-screen bg-background">
        <Dashboard />
      </div>
      <Toaster />
    </>
  );
}

export default App;
