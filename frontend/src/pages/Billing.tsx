import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import BillingDashboard from '@/components/billing/BillingDashboard';

const BillingPage = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-medical-50 to-white">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-4 flex items-center justify-between">
            <SidebarTrigger className="text-medical-600 hover:text-medical-800" />
            <h1 className="text-2xl font-bold text-medical-800">Facturación</h1>
          </div>
          <BillingDashboard />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default BillingPage;
