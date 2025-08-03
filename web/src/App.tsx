// @ts-nocheck
import DashboardPage from "@/app/dashboard/page";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "./pages/Dashboard";
import DashboardWithStore from "./pages/DashboardWithStore";
import "./utils/testInfiniteLoop";

function App() {
  return (
    <>
      <DashboardPage />
      <DashboardWithStore />
      {/* <div className="min-h-screen bg-background">
        <Dashboard />
      </div> */}
      <Toaster />
    </>
  );
}

export default App;
