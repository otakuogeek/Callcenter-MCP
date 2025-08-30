
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, User, Bell, Bot, Users } from "lucide-react";
import ManagementModule from "@/components/ManagementModule";
import SettingsHeader from "@/components/settings/SettingsHeader";
import GeneralTab from "@/components/settings/GeneralTab";
import AITab from "@/components/settings/AITab";
import UsersTab from "@/components/settings/UsersTab";
import NotificationsTab from "@/components/settings/NotificationsTab";

const Settings = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-medical-50 to-white">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-4">
            <SidebarTrigger className="text-medical-600 hover:text-medical-800" />
          </div>
          
          <div className="space-y-6">
            <SettingsHeader 
              title="Configuración del Sistema"
              description="Personaliza y configura el sistema de call center"
            />

            <Tabs defaultValue="general" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general" className="flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="management" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Gestión
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  IA
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Usuarios
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notificaciones
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general">
                <GeneralTab />
              </TabsContent>

              <TabsContent value="management">
                <ManagementModule />
              </TabsContent>

              <TabsContent value="ai">
                <AITab />
              </TabsContent>

              <TabsContent value="users">
                <UsersTab />
              </TabsContent>

              <TabsContent value="notifications">
                <NotificationsTab />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Settings;
