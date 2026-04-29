import { ReactNode, useEffect, useRef, useState } from 'react';
import { CheckSquare, GanttChart, MessageSquare, StickyNote, UploadCloud } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import WorkspaceAssistant from '@/components/WorkspaceAssistant';
import { useWorkspaceSettings } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface AppLayoutProps {
  children: ReactNode;
}

const importActionPattern = /\b(import|upload|parse|load|sync)\b/i;
const legacyAdminMailbox = 'Admin mailbox: admin@company.com';
const currentAdminMailbox = 'Admin mailbox: haitham.pm@gmail.com';

const AppLayout = ({ children }: AppLayoutProps) => {
  const { data: settings } = useWorkspaceSettings();
  const isArabic = settings?.appearance.language === 'ar';
  const sidebarCollapsed = settings?.appearance.sidebarCollapsed ?? false;
  const navigate = useNavigate();
  const location = useLocation();
  const [fileProgressVisible, setFileProgressVisible] = useState(false);
  const [fileProgress, setFileProgress] = useState(0);
  const [fileProgressLabel, setFileProgressLabel] = useState('Preparing import...');
  const progressTimer = useRef<ReturnType<typeof window.setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.lang = isArabic ? 'ar' : 'en';
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
  }, [isArabic]);

  useEffect(() => {
    if (location.pathname !== '/settings') return undefined;

    const replaceLegacyAdminMailbox = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.textContent?.includes(legacyAdminMailbox)) {
          node.textContent = node.textContent.replace(legacyAdminMailbox, currentAdminMailbox);
        }
        node = walker.nextNode();
      }
    };

    replaceLegacyAdminMailbox();
    const observer = new MutationObserver(replaceLegacyAdminMailbox);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    const clearTimers = () => {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      progressTimer.current = null;
      hideTimer.current = null;
    };

    const startProgress = (label: string) => {
      clearTimers();
      setFileProgressLabel(label);
      setFileProgressVisible(true);
      setFileProgress(8);

      progressTimer.current = window.setInterval(() => {
        setFileProgress((current) => {
          if (current >= 92) return current;
          if (current < 35) return current + 9;
          if (current < 70) return current + 5;
          return current + 2;
        });
      }, 350);
    };

    const completeProgress = () => {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
      progressTimer.current = null;
      setFileProgress(100);
      hideTimer.current = window.setTimeout(() => {
        setFileProgressVisible(false);
        setFileProgress(0);
      }, 900);
    };

    const handleFileChange = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (target?.type !== 'file' || !target.files?.length) return;
      const fileName = target.files[0]?.name;
      startProgress(fileName ? `Loading ${fileName}...` : 'Loading import file...');
      window.setTimeout(completeProgress, 2200);
    };

    const handleImportClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button) return;
      const label = button.textContent?.trim() ?? '';
      if (!importActionPattern.test(label)) return;
      if (button.disabled) return;
      startProgress(label ? `${label} in progress...` : 'Import in progress...');
      window.setTimeout(completeProgress, 4500);
    };

    const handleManualProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string; progress?: number; done?: boolean }>).detail;
      if (detail?.done) {
        completeProgress();
        return;
      }
      if (!fileProgressVisible) startProgress(detail?.label ?? 'Import in progress...');
      if (typeof detail?.progress === 'number') {
        setFileProgress(Math.max(0, Math.min(100, detail.progress)));
      }
      if (detail?.label) setFileProgressLabel(detail.label);
    };

    window.addEventListener('change', handleFileChange, true);
    window.addEventListener('click', handleImportClick, true);
    window.addEventListener('workspace-import-progress', handleManualProgress as EventListener);

    return () => {
      clearTimers();
      window.removeEventListener('change', handleFileChange, true);
      window.removeEventListener('click', handleImportClick, true);
      window.removeEventListener('workspace-import-progress', handleManualProgress as EventListener);
    };
  }, [fileProgressVisible]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.10),_transparent_42%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.45))]" />
      {fileProgressVisible && (
        <div className={`fixed top-3 z-[70] w-[calc(100vw-1.5rem)] max-w-md ${isArabic ? 'left-3 sm:left-5' : 'right-3 sm:right-5'}`}>
          <div className="rounded-2xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UploadCloud className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">File import progress</p>
                  <p className="truncate text-xs text-muted-foreground">{fileProgressLabel}</p>
                </div>
              </div>
              <span className="text-xs font-black text-primary">{Math.round(fileProgress)}%</span>
            </div>
            <Progress value={fileProgress} className="h-2" />
          </div>
        </div>
      )}
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
