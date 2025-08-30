import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Index from "./pages/Index";
import PatientsPage from "./pages/PatientsPage";
import NewPatientPage from "./pages/NewPatientPage";
import Appointments from "./pages/Appointments";
import DailySchedule from "./pages/DailySchedule";
import Calls from "./pages/Calls";
import CallsPage from "./pages/CallsPage";
import CallCenter from "./pages/CallCenter";
import Queue from "./pages/Queue";
import Agents from "./pages/Agents";
import Consultations from "./pages/Consultations";
import Locations from "./pages/Locations";
import Analytics from "./pages/Analytics";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import AgendaManagement from "./pages/AgendaManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/patients" element={
            <ProtectedRoute>
              <PatientsPage />
            </ProtectedRoute>
          } />
          <Route path="/patients/new" element={
            <ProtectedRoute>
              <NewPatientPage />
            </ProtectedRoute>
          } />
          <Route path="/appointments" element={
            <ProtectedRoute>
              <Appointments />
            </ProtectedRoute>
          } />
          <Route path="/daily-schedule" element={
            <ProtectedRoute>
              <DailySchedule />
            </ProtectedRoute>
          } />
          <Route path="/calls" element={
            <ProtectedRoute>
              <Calls />
            </ProtectedRoute>
          } />
          <Route path="/calls/monitor" element={
            <ProtectedRoute>
              <CallsPage />
            </ProtectedRoute>
          } />
          <Route path="/callcenter" element={
            <ProtectedRoute>
              <CallCenter />
            </ProtectedRoute>
          } />
          <Route path="/queue" element={
            <ProtectedRoute>
              <Queue />
            </ProtectedRoute>
          } />
          <Route path="/agents" element={
            <ProtectedRoute>
              <Agents />
            </ProtectedRoute>
          } />
          <Route path="/consultations" element={
            <ProtectedRoute>
              <Consultations />
            </ProtectedRoute>
          } />
          <Route path="/locations" element={
            <ProtectedRoute>
              <Locations />
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          } />
          <Route path="/billing" element={
            <ProtectedRoute>
              <Billing />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/agenda-management" element={
            <ProtectedRoute>
              <AgendaManagement />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
