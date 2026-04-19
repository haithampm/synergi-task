import { ReactNode, useEffect } from 'react';
import { CheckSquare, MessageSquare, StickyNote } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import { useWorkspaceSettings } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { data: settings } = useWorkspaceSettings();
  const isArabic = settings?.appearance.language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.lang = isArabic ? 'ar' : 'en';
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
  }, [isArabic]);

  return (
    <div className="min-h-screen bg-background" dir={isArabic ? 'rtl' : 'ltr'}>
      <AppSidebar />
      <main className={`${isArabic ? 'pr-[68px] md:pr-[240px]' : 'pl-[68px] md:pl-[240px]'} pb-24 transition-all duration-300`}>
        {children}
      </main>
      <div className={`fixed bottom-4 z-40 ${isArabic ? 'left-4 md:left-8' : 'right-4 md:right-8'}`}>
        <div className="flex items-center gap-2 rounded-2xl border bg-background/90 p-2 shadow-xl backdrop-blur">
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
