
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import AppointmentsDashboard from "@/components/AppointmentsDashboard";

const Index = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-medical-50 to-white">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-4">
            <SidebarTrigger className="text-medical-600 hover:text-medical-800" />
          </div>
          <AppointmentsDashboard />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Index;
