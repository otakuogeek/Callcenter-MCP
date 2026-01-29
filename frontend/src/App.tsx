import { Suspense, lazy, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import LoadingScreen from "@/components/LoadingScreen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import DoctorProtectedRoute from "./components/DoctorProtectedRoute";
import { api } from "./lib/api";

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
const AuditPage = lazy(() => import("./pages/AuditPage"));
const AgendaManagement = lazy(() => import("./pages/AgendaManagement"));
const DistributionDashboard = lazy(() => import("./pages/DistributionDashboard"));
const DailyQueue = lazy(() => import("./pages/DailyQueue"));
const MyAppointments = lazy(() => import("./pages/MyAppointments"));
const UserPortal = lazy(() => import("./pages/UserPortal"));
const VerifyAppointment = lazy(() => import("./pages/VerifyAppointment"));
const DoctorLogin = lazy(() => import("./pages/DoctorLogin"));
const DoctorDashboard = lazy(() => import("./pages/DoctorDashboard"));
const SMS = lazy(() => import("./pages/SMS"));
const Wiki = lazy(() => import("./pages/Wiki"));
const WhatsAppDashboard = lazy(() => import("./pages/WhatsAppDashboard"));
const Orders = lazy(() => import("./pages/Orders"));
const Support = lazy(() => import("./pages/Support"));
const SupportAdmin = lazy(() => import("./pages/SupportAdmin"));
const SupportPanel = lazy(() => import("./pages/SupportPanel"));
const SupportPanelLogin = lazy(() => import("./pages/SupportPanelLogin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MaintenancePage = lazy(() => import("./pages/MaintenancePage"));

// Cédulas autorizadas para bypass de mantenimiento (para pruebas)
const MAINTENANCE_BYPASS_CEDULAS = ['17265900'];

const UserPortalWrapper = () => {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bypassMaintenance, setBypassMaintenance] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Verificar bypass por URL: ?bypass=17265900
        const urlParams = new URLSearchParams(window.location.search);
        const bypassCedula = urlParams.get('bypass');
        
        // Verificar bypass guardado en localStorage
        const savedBypass = localStorage.getItem('maintenance_bypass');
        
        if (bypassCedula && MAINTENANCE_BYPASS_CEDULAS.includes(bypassCedula)) {
          // Guardar bypass en localStorage para futuras visitas
          localStorage.setItem('maintenance_bypass', bypassCedula);
          setBypassMaintenance(true);
          setIsLoading(false);
          return;
        }
        
        if (savedBypass && MAINTENANCE_BYPASS_CEDULAS.includes(savedBypass)) {
          setBypassMaintenance(true);
          setIsLoading(false);
          return;
        }

        const res = await api.get('/public/maintenance-status');
        if ((res as any)?.success && (res as any)?.maintenance_mode) {
          setIsMaintenance(true);
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    };
    checkStatus();
  }, []);

  if (isLoading) return <LoadingScreen className="h-screen" label="Verificando estado..." />;
  if (isMaintenance && !bypassMaintenance) return <MaintenancePage />;
  return <UserPortal />;
};

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
          v7_relativeSplatPath: true,
          v7_fetcherPersist: true,
          v7_normalizeFormMethod: true,
          v7_partialHydration: true,
          v7_skipActionErrorRevalidation: true
        }}
      >
        {/* Router Configuration with v7 flags enabled */}
        <Suspense fallback={<LoadingScreen className="h-screen" label="Cargando módulo..." />}>
          <Routes>
            {/* Portal de Usuarios - Ruta Principal */}
            <Route path="/" element={<UserPortalWrapper />} />
            
            {/* Login y Rutas de Doctores */}
            <Route path="/login" element={<Navigate to="/admin/login" replace />} />
            <Route path="/admin/login" element={<Login />} />
            <Route path="/doctor-login" element={<DoctorLogin />} />
            <Route path="/doctor-dashboard" element={
              <DoctorProtectedRoute>
                <DoctorDashboard />
              </DoctorProtectedRoute>
            } />
            
            {/* Dashboard Administrativo */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
            <Route path="/admin/patients" element={
              <ProtectedRoute>
                <PatientsModernPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/patients-modern" element={
              <ProtectedRoute>
                <PatientsModernPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/patients/new" element={
              <ProtectedRoute>
                <NewPatientPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/appointments" element={
              <ProtectedRoute>
                <Appointments />
              </ProtectedRoute>
            } />
            <Route path="/admin/daily-schedule" element={
              <ProtectedRoute>
                <DailySchedule />
              </ProtectedRoute>
            } />
            <Route path="/admin/calls" element={
              <ProtectedRoute>
                <Calls />
              </ProtectedRoute>
            } />
            <Route path="/admin/calls/monitor" element={
              <ProtectedRoute>
                <CallsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/callcenter" element={
              <ProtectedRoute>
                <CallCenter />
              </ProtectedRoute>
            } />
            <Route path="/admin/queue" element={
              <ProtectedRoute>
                <Queue />
              </ProtectedRoute>
            } />
            <Route path="/admin/agents" element={
              <ProtectedRoute>
                <Agents />
              </ProtectedRoute>
            } />
            <Route path="/admin/consultations" element={
              <ProtectedRoute>
                <Consultations />
              </ProtectedRoute>
            } />
            <Route path="/admin/orders" element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            } />
            <Route path="/admin/support" element={
              <ProtectedRoute>
                <Support />
              </ProtectedRoute>
            } />
            <Route path="/admin/support-admin" element={
              <ProtectedRoute>
                <SupportAdmin />
              </ProtectedRoute>
            } />
            <Route path="/admin/locations" element={
              <ProtectedRoute>
                <Locations />
              </ProtectedRoute>
            } />
            <Route path="/admin/analytics" element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            } />
            <Route path="/admin/billing" element={
              <ProtectedRoute>
                <Billing />
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/admin/audit" element={
              <ProtectedRoute>
                <AuditPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/agenda-management" element={
              <ProtectedRoute>
                <AgendaManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/distribution" element={
              <ProtectedRoute>
                <DistributionDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/daily-queue" element={
              <ProtectedRoute>
                <DailyQueue />
              </ProtectedRoute>
            } />
            <Route path="/admin/sms" element={
              <ProtectedRoute>
                <SMS />
              </ProtectedRoute>
            } />
            <Route path="/admin/wiki" element={
              <ProtectedRoute>
                <Wiki />
              </ProtectedRoute>
            } />
            <Route path="/admin/wiki/:slug" element={
              <ProtectedRoute>
                <Wiki />
              </ProtectedRoute>
            } />
            <Route path="/admin/whatsapp" element={
              <ProtectedRoute>
                <WhatsAppDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/whatsapp/docs" element={
              <ProtectedRoute>
                <WhatsAppDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/my-appointments" element={
              <ProtectedRoute>
                <MyAppointments />
              </ProtectedRoute>
            } />
            
            {/* Panel de Soporte Independiente */}
            <Route path="/support-panel-login" element={
              <Suspense fallback={<LoadingScreen />}>
                <SupportPanelLogin />
              </Suspense>
            } />
            <Route path="/support-panel" element={
              <Suspense fallback={<LoadingScreen />}>
                <SupportPanel />
              </Suspense>
            } />
            
            {/* Ruta de usuarios antigua para compatibilidad */}
            <Route path="/users" element={<UserPortalWrapper />} />
            
            {/* Ruta pública para verificar citas escaneando QR */}
            <Route path="/verificar/:appointmentId" element={<VerifyAppointment />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
