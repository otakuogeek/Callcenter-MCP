import React from 'react';
import { DailyQueueManager } from '@/components/DailyQueueManager';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function QueueManagementPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <SidebarTrigger />
        <DailyQueueManager />
      </main>
    </SidebarProvider>
  );
}

export default QueueManagementPage;