import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import LoadingScreen from "@/components/LoadingScreen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import DoctorProtectedRoute from "./components/DoctorProtectedRoute";

const Login = lazy(() => import("./pages/Login"));
const Index = lazy(() => import("./pages/Index"));
const PatientsModernPage = lazy(() => import("./pages/PatientsModernPage"));
const NewPatientPage = lazy(() => import("./pages/NewPatientPage"));
const Appointments = lazy(() => import("./pages/Appointments"));
const DailySchedule = lazy(() => import("./pages/DailySchedule"));
const Calls = lazy(() => import("./pages/Calls"));
const CallsPage = lazy(() => import("./pages/CallsPage"));
const CallCenter = lazy(() => import("./pages/CallCenter"));
const Queue = lazy(() => import("./pages/Queue"));
const Agents = lazy(() => import("./pages/Agents"));
const Consultations = lazy(() => import("./pages/Consultations"));
const Locations = lazy(() => import("./pages/Locations"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Billing = lazy(() => import("./pages/Billing"));
const Settings = lazy(() => import("./pages/Settings"));
const AgendaManagement = lazy(() => import("./pages/AgendaManagement"));
const DistributionDashboard = lazy(() => import("./pages/DistributionDashboard"));
const DailyQueue = lazy(() => import("./pages/DailyQueue"));
const MyAppointments = lazy(() => import("./pages/MyAppointments"));
const UserPortal = lazy(() => import("./pages/UserPortal"));
const DoctorLogin = lazy(() => import("./pages/DoctorLogin"));
const DoctorDashboard = lazy(() => import("./pages/DoctorDashboard"));
const SMS = lazy(() => import("./pages/SMS"));
const Wiki = lazy(() => import("./pages/Wiki"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 30,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <Suspense fallback={<LoadingScreen className="h-screen" label="Cargando módulo..." />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/doctor-login" element={<DoctorLogin />} />
            <Route path="/doctor-dashboard" element={
              <DoctorProtectedRoute>
                <DoctorDashboard />
              </DoctorProtectedRoute>
            } />
            <Route path="/" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
            <Route path="/patients" element={
              <ProtectedRoute>
                <PatientsModernPage />
              </ProtectedRoute>
            } />
            <Route path="/patients-modern" element={
              <ProtectedRoute>
                <PatientsModernPage />
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
            <Route path="/distribution" element={
              <ProtectedRoute>
                <DistributionDashboard />
              </ProtectedRoute>
            } />
            <Route path="/daily-queue" element={
              <ProtectedRoute>
                <DailyQueue />
              </ProtectedRoute>
            } />
            <Route path="/sms" element={
              <ProtectedRoute>
                <SMS />
              </ProtectedRoute>
            } />
            <Route path="/wiki" element={
              <ProtectedRoute>
                <Wiki />
              </ProtectedRoute>
            } />
            <Route path="/wiki/:slug" element={
              <ProtectedRoute>
                <Wiki />
              </ProtectedRoute>
            } />
            <Route path="/my-appointments" element={
              <ProtectedRoute>
                <MyAppointments />
              </ProtectedRoute>
            } />
            <Route path="/users" element={<UserPortal />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
