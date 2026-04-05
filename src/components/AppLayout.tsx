import { Outlet, useSearchParams } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Separator } from '@/components/ui/separator';
import { CommandPalette } from '@/components/CommandPalette';
import { OnboardingBanner } from '@/components/OnboardingBanner';

export function AppLayout() {
  const [searchParams] = useSearchParams();
  const isSharedView = searchParams.get('view') === 'shared';

  // Shared views bypass sidebar entirely
  if (isSharedView) {
    return <Outlet />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <CommandPalette />
      <SidebarInset className="overflow-hidden flex flex-col">
        {/* Mobile header bar with sidebar trigger */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>
        <main className="flex-1 min-h-0 overflow-auto">
          <OnboardingBanner />
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
