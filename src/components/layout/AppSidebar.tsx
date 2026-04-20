import { Fragment, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users, MessageSquare,
  BarChart3, Ticket, Settings, ChevronLeft, ChevronRight, Sparkles,
  Sun, Moon, LogOut, Search, FileUp, GanttChart, CalendarDays, Files, BriefcaseBusiness, StickyNote, User, Activity
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateWorkspaceSettings, useWorkspaceSettings } from '@/hooks/useProjects';
import { translateText } from '@/lib/i18n';

const navSections = [
  {
    title: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: BarChart3, label: 'Reports', path: '/reports' },
    ],
  },
  {
    title: 'Planning',
    items: [
      { icon: FolderKanban, label: 'Projects', path: '/projects' },
      { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
      { icon: GanttChart, label: 'Schedule', path: '/schedule' },
      { icon: CalendarDays, label: 'Calendar', path: '/calendar' },
      { icon: BriefcaseBusiness, label: 'Resources', path: '/resources' },
      { icon: Files, label: 'Documents', path: '/documents' },
      { icon: Ticket, label: 'Tickets', path: '/tickets' },
    ],
  },
  {
    title: 'Collaboration',
    items: [
      { icon: Users, label: 'Team', path: '/team' },
      { icon: MessageSquare, label: 'AI Agent', path: '/ai-chat', highlight: true },
      { icon: FileUp, label: 'Import/Export', path: '/import-export' },
    ],
  },
  {
    title: 'Personal Workspace',
    items: [
      { icon: User, label: 'My Profile', path: '/profile' },
      { icon: StickyNote, label: 'Sticky Notes', path: '/sticky-notes' },
      { icon: CheckSquare, label: 'To Do', path: '/tasks' },
      { icon: MessageSquare, label: 'Team Chat', path: '/team-chat' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { icon: Activity, label: 'App Monitor', path: '/app-monitor' },
      { icon: Settings, label: 'Settings', path: '/settings' },
    ],
  },
];

const AppSidebar = () => {
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const location = useLocation();
  const { signOut } = useAuth();
  const { data: settings } = useWorkspaceSettings();
  const updateSettings = useUpdateWorkspaceSettings();
  const language = settings?.appearance.language ?? 'en';
  const isArabic = language === 'ar';
  const collapsed = settings?.appearance.sidebarCollapsed ?? false;
  const sidebarAutoHide = settings?.appearance.sidebarAutoHide ?? true;
  const compactDesktop = isDesktop && collapsed;

  useEffect(() => {
    const handleResize = () => {
      const nextDesktop = window.innerWidth >= 1024;
      setIsDesktop(nextDesktop);
      if (nextDesktop) {
        setMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleToggle = () => {
      if (isDesktop || !sidebarAutoHide) {
        if (!settings || updateSettings.isPending) return;
        updateSettings.mutate({
          ...settings,
          appearance: {
            ...settings.appearance,
            sidebarCollapsed: !collapsed,
          },
        });
        return;
      }

      setMobileOpen((prev) => !prev);
    };

    window.addEventListener('workspace-sidebar-toggle', handleToggle);
    return () => window.removeEventListener('workspace-sidebar-toggle', handleToggle);
  }, [collapsed, isDesktop, settings, sidebarAutoHide, updateSettings]);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode(!darkMode);
  };

  const triggerSearch = () => {
    window.dispatchEvent(new CustomEvent('workspace-search-open', { detail: { query: '' } }));
  };

  const closeMobileSidebar = () => {
    if (!isDesktop) {
      setMobileOpen(false);
    }
  };

  const toggleSidebarMode = () => {
    if (!settings) return;

    if (isDesktop || !sidebarAutoHide) {
      updateSettings.mutate({
        ...settings,
        appearance: {
          ...settings.appearance,
          sidebarCollapsed: !collapsed,
        },
      });
      return;
    }

    setMobileOpen((prev) => !prev);
  };

  const sidebarOpen = isDesktop || mobileOpen;

  return (
    <>
      {!isDesktop && mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={closeMobileSidebar}
        />
      ) : null}
      <aside
        dir={isArabic ? 'rtl' : 'ltr'}
        className={`fixed top-0 z-40 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col ${
          isArabic ? 'right-0' : 'left-0'
        } ${
          sidebarOpen ? 'translate-x-0' : isArabic ? 'translate-x-full' : '-translate-x-full'
        } w-[280px] lg:translate-x-0 ${compactDesktop ? 'lg:w-[68px]' : 'lg:w-[240px]'}`}
      >
      <Link
        to="/"
        onClick={closeMobileSidebar}
        className="flex h-14 items-center gap-3 px-4 border-b border-sidebar-border hover:bg-sidebar-accent/30 transition-colors"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
          <FolderKanban className="h-4 w-4 text-primary-foreground" />
        </div>
        {!compactDesktop && (
          <span className="text-sm font-bold tracking-tight animate-fade-in">{settings?.branding.appName ?? 'Synergi PM'}</span>
        )}
      </Link>

      {!compactDesktop && (
        <div className="mx-3 mt-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-sidebar-accent/50 text-sidebar-muted text-xs cursor-pointer hover:bg-sidebar-accent transition-colors"
            onClick={triggerSearch}
          >
            <Search className="h-3 w-3" />
            <span>{translateText(language, 'Search')}</span>
            <kbd className="ml-auto text-[10px] border border-sidebar-border rounded px-1">Ctrl K</kbd>
          </div>
        </div>
      )}

      <nav className="flex-1 py-3 px-3 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <Fragment key={section.title}>
            {!compactDesktop ? (
              <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-muted">
                {translateText(language, section.title)}
              </div>
            ) : (
              <div className="mx-auto h-px w-8 bg-sidebar-border/70" />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const itemPathname = item.path.split('?')[0];
                const isActive = location.pathname === itemPathname ||
                  (itemPathname !== '/' && location.pathname.startsWith(itemPathname));

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={closeMobileSidebar}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 group ${
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-glow'
                        : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <item.icon className={`h-4 w-4 shrink-0 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} />
                    {!compactDesktop && <span className="animate-fade-in">{translateText(language, item.label)}</span>}
                    {!compactDesktop && item.highlight && (
                      <Sparkles className="ml-auto h-3 w-3 text-accent" />
                    )}
                  </Link>
                );
              })}
            </div>
          </Fragment>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2 space-y-1">
        <Link
          to="/profile"
          className={`mb-2 flex items-center gap-3 rounded-lg border border-sidebar-border/70 px-3 py-2 transition-colors hover:bg-sidebar-accent/40 ${compactDesktop ? 'justify-center px-2' : ''}`}
          onClick={closeMobileSidebar}
        >
            {settings?.profile.avatarUrl ? (
              <img src={settings.profile.avatarUrl} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
                {(settings?.currentUser.displayName ?? 'U').split(' ').map((part) => part[0]).join('').slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              {!compactDesktop && (
                <>
                  <p className="truncate text-sm font-medium">{settings?.currentUser.displayName ?? 'Workspace User'}</p>
                  <p className="truncate text-[11px] text-sidebar-muted">{settings?.profile.email ?? 'No email'}</p>
                </>
              )}
            </div>
        </Link>
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          {darkMode ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!compactDesktop && <span>{translateText(language, darkMode ? 'Light Mode' : 'Dark Mode')}</span>}
        </button>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-muted hover:bg-destructive/20 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!compactDesktop && <span>{translateText(language, 'Sign Out')}</span>}
        </button>
        <button
          onClick={toggleSidebarMode}
          className="w-full flex items-center justify-center py-1.5 text-sidebar-muted hover:text-sidebar-foreground transition-colors"
        >
          {compactDesktop ? <ChevronRight className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} /> : <ChevronLeft className={`h-4 w-4 ${isArabic ? 'rotate-180' : ''}`} />}
        </button>
      </div>
    </aside>
    </>
  );
};

export default AppSidebar;
