import { ReactNode, useEffect } from 'react';
import { CheckSquare, GanttChart, MessageSquare, StickyNote } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import WorkspaceAssistant from '@/components/WorkspaceAssistant';
import { useWorkspaceSettings } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { data: settings } = useWorkspaceSettings();
  const isArabic = settings?.appearance.language === 'ar';
  const sidebarCollapsed = settings?.appearance.sidebarCollapsed ?? false;
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.lang = isArabic ? 'ar' : 'en';
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
  }, [isArabic]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.10),_transparent_42%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.45))]" />
      <AppSidebar />
      <main
        className={`min-w-0 pb-28 transition-all duration-300 ${
          isArabic
            ? sidebarCollapsed
              ? 'lg:pr-[68px]'
              : 'lg:pr-72'
            : sidebarCollapsed
              ? 'lg:pl-[68px]'
              : 'lg:pl-72'
        }`}
      >
        <div className="min-w-0 overflow-x-hidden">
          {children}
        </div>
        <div className="px-4 pb-6 pt-2 text-center text-xs text-muted-foreground sm:px-6">
          {`© ${new Date().getFullYear()} ${settings?.branding.appName ?? 'Synergi PM Workspace'} by Haitham Elmohamady`}
        </div>
      </main>
      <div className={`fixed bottom-4 z-40 ${isArabic ? 'left-3 sm:left-4 md:left-8' : 'right-3 sm:right-4 md:right-8'}`}>
        <div className="flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/90 p-2 shadow-xl backdrop-blur-xl sm:max-w-[calc(100vw-2rem)] md:max-w-none">
          <WorkspaceAssistant isArabic={isArabic} />
          <Button
            size="sm"
            variant={location.pathname === '/schedule' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => navigate('/schedule')}
          >
            <GanttChart className="h-4 w-4" />
            <span className="hidden sm:inline">Schedule</span>
          </Button>
          <Button
            size="sm"
            variant={location.pathname === '/sticky-notes' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => navigate('/sticky-notes')}
          >
            <StickyNote className="h-4 w-4" />
            <span className="hidden sm:inline">Sticky Notes</span>
          </Button>
          <Button
            size="sm"
            variant={location.pathname === '/tasks' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => navigate('/tasks')}
          >
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">To Do</span>
          </Button>
          <Button
            size="sm"
            variant={location.pathname === '/team-chat' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => navigate('/team-chat')}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Team Chat</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
