import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RoleSimulationProvider } from "./contexts/RoleSimulationContext";
import { AppLayout } from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Index from "./pages/Index";
import ProjectBudget from "./pages/ProjectBudget";
import ProjectCanvas from "./pages/ProjectCanvas";
import Calendar from "./pages/Calendar";
import Quotes from "./pages/Quotes";
import QuoteDetail from "./pages/QuoteDetail";
import ApprovedProjects from "./pages/ApprovedProjects";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import RolesDocumentation from "./pages/RolesDocumentation";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import EmailConfirmed from "./pages/EmailConfirmed";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import PublicTimesheet from "./pages/PublicTimesheet";
import StyleGuide from "./pages/StyleGuide";
import Workload from "./pages/Workload";
import Workflows from "./pages/Workflows";
import Help from "./pages/Help";
import UserActionLogs from "./pages/UserActionLogs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RoleSimulationProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/email-confirmed" element={<EmailConfirmed />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/timesheet/public" element={<PublicTimesheet />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/budgets" element={<AppLayout><Index /></AppLayout>} />
            <Route path="/calendar" element={<AppLayout><Calendar /></AppLayout>} />
            <Route path="/projects" element={<Navigate to="/budgets" replace />} />
            <Route path="/projects/:projectId" element={<AppLayout><ProjectBudget /></AppLayout>} />
            <Route path="/projects/:projectId/canvas" element={<AppLayout><ProjectCanvas /></AppLayout>} />
            <Route path="/approved-projects" element={<AppLayout><ApprovedProjects /></AppLayout>} />
            <Route path="/quotes" element={<AppLayout><Quotes /></AppLayout>} />
            <Route path="/quotes/:quoteId" element={<AppLayout><QuoteDetail /></AppLayout>} />
            <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
            <Route path="/roles-documentation" element={<AppLayout><RolesDocumentation /></AppLayout>} />
            <Route path="/notifications" element={<AppLayout><Notifications /></AppLayout>} />
            <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
            <Route path="/style-guide" element={<AppLayout><StyleGuide /></AppLayout>} />
            <Route path="/workload" element={<AppLayout><Workload /></AppLayout>} />
            <Route path="/workflows" element={<AppLayout><Workflows /></AppLayout>} />
            <Route path="/help" element={<AppLayout><Help /></AppLayout>} />
            <Route path="/user-action-logs" element={<AppLayout><UserActionLogs /></AppLayout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </RoleSimulationProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
