import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PatientsModernView } from "@/components/patients-modern/PatientsModernView";

const PatientsModernPage = () => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full min-h-screen bg-gray-50">
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3">
          <SidebarTrigger />
        </div>
        <PatientsModernView />
      </main>
    </SidebarProvider>
  );
};

export default PatientsModernPage;
