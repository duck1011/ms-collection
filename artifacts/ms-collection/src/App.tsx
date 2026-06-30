import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import CreateReceipt from "@/pages/CreateReceipt";
import History from "@/pages/History";
import SettingsPage from "@/pages/Settings";
import FinancialDashboard from "@/pages/FinancialDashboard";
import LockScreen from "@/pages/LockScreen";
import NotFound from "@/pages/not-found";
import { isAuthenticated } from "@/lib/auth";
import { useEffect } from "react";

const queryClient = new QueryClient();

// ── Protected Route Guard ──────────────────────────────────────────

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/lock");
    }
  }, [setLocation]);

  if (!isAuthenticated()) {
    return null;
  }

  return <Component />;
}

// ── Router ─────────────────────────────────────────────────────────

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/lock" component={LockScreen} />
        <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
        <Route path="/create" component={() => <ProtectedRoute component={CreateReceipt} />} />
        <Route path="/history" component={() => <ProtectedRoute component={History} />} />
        <Route path="/financial" component={() => <ProtectedRoute component={FinancialDashboard} />} />
        <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

// ── App ────────────────────────────────────────────────────────────

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter hook={useHashLocation}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;