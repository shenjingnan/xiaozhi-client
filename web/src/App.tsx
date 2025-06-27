import { Toaster } from "@/components/ui/toaster";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <>
      <div className="min-h-screen bg-background">
        <Dashboard />
      </div>
      <Toaster />
    </>
  );
}

export default App;
